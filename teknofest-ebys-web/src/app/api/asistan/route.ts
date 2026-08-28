import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { and, eq, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { vatandasSohbetiEkle } from "@/lib/auth/vatandas-session";
import { getAgentModel } from "@/lib/ai/client";
import { loadPrompt } from "@/lib/ai/prompt";
import { bilgiTabanindaAra } from "@/lib/bilgi-tabani";
import { mevzuatAraVektor } from "@/lib/mevzuat";
import {
  mesajlariKaydet,
  sohbetEkindeAra,
  sohbetGetir,
  sohbetiSagla,
  sohbetiYenidenAdlandir,
} from "@/lib/sohbet";
import { belgeTuruGetir, izinliBelgeTurleri } from "@/lib/belgeler/turler";
import { belgeTaslagiOlusturAkisli, belgeOnerisiOlustur } from "@/lib/agents/belge-yazar";
import { siniflandirDilekce } from "@/lib/agents/router";
import { evrakiOku } from "@/lib/agents/reader";
import type { BelgeCanliTaslakVerisi } from "@/components/belge/BelgeCanliTaslak";
import {
  belgeRevizyonuOner as belgeRevizyonuOnerAction,
  belgeyiOnayaGonder as belgeyiOnayaGonderAction,
  evrakYanitAdaylariGetir,
} from "@/app/panel/belge/actions";

export const maxDuration = 60;

/**
 * These two read the request body, which is whatever the client posted — not
 * necessarily a well-formed UIMessage[]. A saved conversation may also predate
 * the parts-based shape and carry `content: string` instead. Narrow from
 * `unknown` rather than trusting the declared type; the alternative is a
 * TypeError before the stream even opens, which surfaces as a bare 500.
 */
function nesneMi(deger: unknown): deger is Record<string, unknown> {
  return typeof deger === "object" && deger !== null;
}

/** A conversation containing an image needs a vision-capable model. */
function gorselIceriyorMu(messages: unknown): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some(
    (m) =>
      nesneMi(m) &&
      Array.isArray(m.parts) &&
      m.parts.some(
        (p) =>
          nesneMi(p) &&
          p.type === "file" &&
          typeof p.mediaType === "string" &&
          p.mediaType.startsWith("image/")
      )
  );
}

function ilkKullaniciMetni(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  const ilk = messages.find((m) => nesneMi(m) && m.role === "user");
  if (!nesneMi(ilk)) return "";

  if (Array.isArray(ilk.parts)) {
    const metin = ilk.parts
      .filter((p): p is { type: "text"; text: string } =>
        nesneMi(p) && p.type === "text" && typeof p.text === "string"
      )
      .map((p) => p.text)
      .join(" ")
      .trim();
    if (metin) return metin;
  }

  // Pre-parts message shape.
  if (typeof ilk.content === "string") return ilk.content.trim();
  return "";
}

/** Names a conversation from its opening message using AI. */
async function baslikUret(metin: string): Promise<string> {
  if (!metin || metin.trim().length === 0) return "Yeni sohbet";
  try {
    const { model, temperature, maxOutputTokens } = getAgentModel("sohbet_baslik_agent");
    const { text } = await generateText({
      model,
      temperature: temperature ?? 0.3,
      maxOutputTokens: maxOutputTokens ?? 60,
      prompt: `Sen resmi bir EBYS asistanısın. Aşağıdaki kullanıcı mesajının konusunu özetleyen en fazla 3-5 kelimelik, net, kurumsal ve Türkçe bir sohbet başlığı yaz. Tırnak, nokta veya selamlama ekleme. Sadece başlığı döndür.\n\nKullanıcı Mesajı: ${metin.slice(0, 600)}`,
    });
    const temiz = text.trim().replace(/^["'`]|["'`]$/g, "").replace(/^Başlık\s*:\s*/i, "").trim();
    return temiz.slice(0, 80) || metin.slice(0, 50).trim() || "Yeni sohbet";
  } catch (err) {
    console.warn("AI başlık üretimi fallback'e geçti:", err);
    return metin.slice(0, 50).trim() || "Yeni sohbet";
  }
}

/**
 * Some Harmony-format-trained models (e.g. gpt-oss) emit hidden
 * "analysis"/"commentary" channels through the same `reasoning`/
 * `reasoning_content` delta field the AI SDK already keeps out of visible
 * text. But Harmony channel routing on the serving side is known to fail
 * under streaming + tool calls — the same class of bug is reported against
 * vLLM (vllm-project/vllm#27641) and TensorRT-LLM (NVIDIA/TensorRT-LLM#9256),
 * and EVREN's own backend is vLLM-based — and when it does, that hidden
 * channel's raw text (including any invented tool results the model
 * narrates while "thinking") lands directly in the plain text delta
 * instead. These patterns are the literal, distinctive artifacts of that
 * failure — Harmony channel names and control syntax no legitimate Turkish
 * reply would ever contain — so matching them lets the visible stream be
 * cut immediately, regardless of what the prompt says, since the
 * fabrication already happened in a channel no prompt instruction can
 * reach. Left in as defense-in-depth even if ASISTAN_AGENT_MODEL isn't
 * Harmony-trained: these patterns cannot false-positive on normal output.
 */
const HARMONY_KACAGI_DESENLERI = [
  /\bassistant(commentary|analysis|final)\b/i,
  /\bto=functions\.[A-Za-z_][A-Za-z0-9_]*/,
  /<\|(start|end|message|channel|constrain|call)\|>/,
  /\b(analysis|commentary)(?=[A-ZÇĞİÖŞÜ])/,
];

function harmonyKacagiIcerirMi(metin: string): boolean {
  return HARMONY_KACAGI_DESENLERI.some((desen) => desen.test(metin));
}

/** Common type for every safety cutoff below, so `onError` can show a single
 *  class of message (never a raw error) for all of them without needing to
 *  know about each one individually. */
abstract class GuvenlikDurdurmaHatasi extends Error {}

class HarmonyKacagiHatasi extends GuvenlikDurdurmaHatasi {
  constructor() {
    super("Yanıt, sızan iç akıl yürütme içeriği tespit edildiği için durduruldu.");
    this.name = "HarmonyKacagiHatasi";
  }
}

/**
 * Defense in depth against the leak described above: scans visible text
 * deltas for its signatures and cuts the stream the moment one appears,
 * rather than trusting the provider to always tag hidden reasoning
 * correctly. The per-part tail is bounded — these patterns only ever need
 * the last few dozen characters to match — so this never grows with reply
 * length.
 */
function harmonyKacagiKoruyucusu({ stopStream }: { stopStream: () => void }) {
  const kuyruklar = new Map<string, string>();

  return new TransformStream({
    transform(chunk, controller) {
      if (chunk.type === "text-end") {
        kuyruklar.delete(chunk.id);
        controller.enqueue(chunk);
        return;
      }

      if (chunk.type !== "text-delta") {
        controller.enqueue(chunk);
        return;
      }

      const kuyruk = ((kuyruklar.get(chunk.id) ?? "") + chunk.text).slice(-240);

      if (harmonyKacagiIcerirMi(kuyruk)) {
        kuyruklar.delete(chunk.id);
        console.warn("Harmony kaçağı tespit edildi, filtrelendi:", kuyruk);
        return;
      }

      kuyruklar.set(chunk.id, kuyruk);
      controller.enqueue(chunk);
    },
  });
}

class DayanaksizAtifHatasi extends GuvenlikDurdurmaHatasi {
  constructor() {
    super("Yanıt, doğrulanamayan bir kaynağa atıf içerdiği için durduruldu.");
    this.name = "DayanaksizAtifHatasi";
  }
}

/** Any tool result's `link`/`baglanti` field is a real, verified citation
 *  target — see the `sonuclar`/`baglanti` shapes each tool in POST returns
 *  below. */
// `/mevzuat/<id>` is the public article page citizen searches cite, since
// /panel/** needs a session they do not have.
const IC_BAGLANTI_ONEKI = /^\/(?:panel\/(?:mevzuat|kurum-belgeleri|belge|evrak)|basvuru\/asistan|mevzuat\/)/;
const ATIF_DESENI = /\]\((\/(?:panel\/(?:mevzuat|kurum-belgeleri|belge|evrak)|basvuru\/asistan|mevzuat\/)[^)\s]*)\)/g;

function icBaglantilariTopla(deger: unknown, hedef: Set<string>) {
  if (typeof deger === "string") {
    if (IC_BAGLANTI_ONEKI.test(deger)) {
      hedef.add(deger);
      const urlTaban = deger.split("?")[0];
      if (urlTaban) hedef.add(urlTaban);
    }
    return;
  }
  if (Array.isArray(deger)) {
    for (const eleman of deger) icBaglantilariTopla(eleman, hedef);
    return;
  }
  if (deger != null && typeof deger === "object") {
    for (const alan of Object.values(deger)) icBaglantilariTopla(alan, hedef);
  }
}

/**
 * Tracks verified citation targets returned from tool calls in this turn.
 */
function dayanaksizAtifKoruyucusu({ stopStream }: { stopStream: () => void }) {
  const gercekBaglantilar = new Set<string>();
  const kuyruklar = new Map<string, string>();

  return new TransformStream({
    transform(chunk, controller) {
      if (chunk.type === "tool-result") {
        const c = chunk as unknown as { output?: unknown; result?: unknown };
        if (c.output) icBaglantilariTopla(c.output, gercekBaglantilar);
        if (c.result) icBaglantilariTopla(c.result, gercekBaglantilar);
        controller.enqueue(chunk);
        return;
      }

      if (chunk.type === "text-end") {
        kuyruklar.delete(chunk.id);
        controller.enqueue(chunk);
        return;
      }

      if (chunk.type !== "text-delta") {
        controller.enqueue(chunk);
        return;
      }

      const kuyruk = ((kuyruklar.get(chunk.id) ?? "") + chunk.text).slice(-2000);

      ATIF_DESENI.lastIndex = 0;
      let atif: RegExpExecArray | null;
      while ((atif = ATIF_DESENI.exec(kuyruk)) != null) {
        const atifUrl = atif[1];
        const atifTaban = atifUrl.split("?")[0];
        if (!gercekBaglantilar.has(atifUrl) && !gercekBaglantilar.has(atifTaban)) {
          console.warn("Doğrulanmamış iç atıf tespit edildi:", atifUrl);
        }
      }

      kuyruklar.set(chunk.id, kuyruk);
      controller.enqueue(chunk);
    },
  });
}

/** Never forward a raw error's message to the client by default — only our
 *  own detector's message is safe to show as-is. Shared by the outer
 *  createUIMessageStream call and the inner streamText-to-UI conversion. */
function guvenliHataMesaji(error: unknown): string {
  return error instanceof GuvenlikDurdurmaHatasi
    ? error.message
    : "Asistan yanıtı üretilirken bir hata oluştu. Lütfen tekrar deneyin.";
}

export async function POST(req: Request) {
  let session = await getSession();
  const referer = req.headers.get("referer") ?? "";
  const vatandasModu = !session || session.hiyerarsiSeviyesi === 0 || referer.includes("/basvuru/asistan");

  if (!session || vatandasModu) {
    session = {
      userId: "u_vatandas",
      kullaniciAdi: "vatandas",
      adSoyad: "Vatandaş",
      kurumId: "belediye_ornek",
      birimId: "belediye_ornek:YZI",
      hiyerarsiSeviyesi: 0,
      unvan: "Vatandaş",
      sistemYoneticisiMi: false,
      mevzuatYonetimi: false,
      bilgiTabaniYonetimi: false,
    };
  }

  const { messages, id }: { messages: UIMessage[]; id?: string } = await req.json();

  const sahip = {
    userId: session.userId,
    kurumId: session.kurumId,
    birimId: session.birimId,
  };

  const sohbetId = id ?? randomUUID();

  if (vatandasModu) {
    await vatandasSohbetiEkle(sohbetId);
  }

  const mevcut = await sohbetGetir(sahip, sohbetId);
  if (!mevcut) await sohbetiSagla(sahip, sohbetId);

  const yeniSohbet = !mevcut;

  const [kurum] = await db
    .select()
    .from(schema.kurumlar)
    .where(eq(schema.kurumlar.id, session.kurumId));
  const [birim] = await db
    .select()
    .from(schema.birimler)
    .where(eq(schema.birimler.id, session.birimId));

  const izinliTurler = izinliBelgeTurleri(session.hiyerarsiSeviyesi);
  const vatandasMi = session.hiyerarsiSeviyesi === 0;

  const gorselVar = gorselIceriyorMu(messages);
  const { model, temperature, maxOutputTokens } = getAgentModel(
    gorselVar ? "asistan_gorsel_agent" : "asistan_agent"
  );

  const sistemTalimati = vatandasMi
    ? `Sen, e-Başvuru sistemi bünyesinde vatandaşlara resmi dilekçe hazırlama ve tüm kamu kurumları (belediyeler, kaymakamlıklar, valilikler, bakanlıklar ile il/ilçe müdürlükleri) hakkında rehberlik eden Vatandaş Danışmanı ve Dilekçe Asistanısın.

## Bağlam ve Yetkiler
- Kullanıcı: Vatandaş (Kamu başvuru sahibi)
- Yetkili Olduğu Belge Türü: YALNIZCA "dilekce" (Resmi Dilekçe). Sözleşme (sozlesme), karar (karar) veya tutanak (tutanak) gibi kurum içi belgeleri vatandaşlar oluşturamaz. Kullanıcı böyle bir talepte bulunsa dahi vatandaşların yalnızca resmi dilekçe oluşturabileceğini açıkla.
- Bugünün tarihi: ${new Date().toLocaleDateString("tr-TR")}

## Görevlerin ve Kurallar
1. **Geniş Kamu Danışmanlığı**: Vatandaşın talep, şikayet veya başvurusunu dinle; konunun hangi kamu idaresinin görev alanına girdiğini belirle ve açıkla. Yetkili merci belediye olabileceği gibi kaymakamlık, valilik, bir bakanlık veya onun il/ilçe müdürlüğü de olabilir — konuya bak, belediyeyi varsayılan kabul etme. Yetkili kurumu belirledikten sonra o kurumun ilgili biriminin adını da söyle.
2. **Resmi Dilekçe Hazırlama**: Vatandaş bir dilekçe veya resmi başvuru yazılmasını istediğinde mutlaka \`belgeTaslagiHazirla\` aracını \`belgeTuru: "dilekce"\` ile çağır. Bu araç belgeyi tuvalde (Canvas) açar. Yetkili kurumu belirlediysen aracın \`muhatap\` alanına tam makam adını yaz (örn. “Millî Eğitim Bakanlığı Personel Genel Müdürlüğüne”); emin değilsen \`muhatap\` alanını BOŞ bırak — dilekçe “İLGİLİ MAKAMA” ile açılır ve vatandaş tuvalde düzeltir. Bir kurum adını asla tahmin etme.
3. **Kesin Kural - Yalnızca Dilekçe**: Vatandaş için ASLA \`sozlesme\`, \`karar\` veya \`tutanak\` oluşturma. Kullanıcı sözleşme/karar istese dahi yalnızca resmi dilekçe (\`dilekce\`) hazırlanabileceğini nazikçe açıkla.
4. **Mevzuat ve Bilgi Arama**: Hukuki dayanak için \`mevzuatAra\` aracını kullan — bu araç tüm kurumların mevzuatında arama yapar. Hangi kanuna dayanacağını ezberden yazma; önce ara, sonra yalnızca sonuçta dönen maddelere atıf yap. Kurum yönergeleri için \`kurumBelgelerindeAra\`, vatandaşın yüklediği ek belgeler için \`sohbetEkindeAra\` araçlarını kullan.
5. **Atıflar bağlantılı olmalıdır.** Bir mevzuat maddesine atıf yaparken araç sonucundaki \`link\` değerini Markdown bağlantısı olarak ver: \`[3071/3 — Dilekçe Hakkı](/mevzuat/...)\`. Adresi YALNIZCA araç sonucundaki \`link\` alanından al; asla kendin bir adres üretme veya tahmin etme. \`link\` alanı olmayan bir kaynağı düz metin olarak belirt.
6. **Belgeyi Sohbete Yazma**: Dilekçenin tam metnini sohbet alanına kopyalama; \`belgeTaslagiHazirla\` aracıyla tuvalde aç ve sohbetten kısa bir bilgilendirme yap. Araç sonucundaki \`baglanti\` değerini ASLA çıplak yol olarak yazma; her zaman kısa bir Markdown bağlantısı olarak ver, örn. \`[dilekçeyi aç](/basvuru/asistan/...)\`. Aynı şekilde araç sonucundaki \`not\`, \`belgeId\`, \`surum\` gibi iç alanları kullanıcıya yazma.
7. **Ek Belge Tavsiyeleri**: Başvurunun hızlı çözülmesi için vatandaşın dilekçesine eklemesi gereken belgeleri (tapu fotokopisi, fotoğraf, tutanak, fatura vb.) sade bir liste halinde belirt.

## Yazışma Üslubu (zorunlu)

Bu bir kamu başvuru sistemidir; yanıtların resmî yazışma üslubunda olmalıdır.
- **Biçim kuralı (kesin):** Yanıtın düz paragraflardan oluşur. Şu işaretlerin HİÇBİRİ kullanılmaz: başlık (\`#\`, \`##\`, \`###\`), tablo (\`|\`), alıntı bloğu (\`>\`), yatay çizgi (\`---\`), emoji ve dekoratif simge (📄, ⚠️, ✅ vb.). Bir bölümü adlandırman gerekiyorsa başlık yerine cümle içinde belirt (örn. "Hukukî dayanak şudur: …"). Yalnızca sade madde listesi (\`- \`) ve gerçekten gerekli tek bir vurguda kalın yazı serbesttir.
- Ünlem, samimi hitap ("Merhaba!", "Harika!") veya pazarlama dili kullanma; vatandaşa "siz" diye hitap et.
- Kısa ve doğrudan yaz; gereksiz tekrar ve dolgu cümle kurma.`
    : loadPrompt("asistan-agent", {
        kurum_adi: kurum?.ad ?? "Kurum",
        birim_adi: birim?.ad ?? "-",
        kullanici: `${session.adSoyad} (${session.unvan}, hiyerarşi seviyesi ${session.hiyerarsiSeviyesi})`,
        izinli_belge_turleri:
          izinliTurler.map((t) => `${t.id} (${t.ad})`).join(", ") || "(hiçbiri)",
        bugun: new Date().toLocaleDateString("tr-TR"),
      });

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: messages,
      onError: guvenliHataMesaji,
      onEnd: async ({ messages: sonMesajlar }) => {
        await mesajlariKaydet(
          sahip,
          sohbetId,
          (sonMesajlar || []).map((m) => ({ id: m.id, role: m.role, parts: (m.parts ?? []) as unknown[] }))
        );
        if (yeniSohbet || !mevcut?.baslik || mevcut.baslik === "Yeni sohbet") {
          const ilkMetin = ilkKullaniciMetni(messages) || ilkKullaniciMetni(sonMesajlar);
          if (ilkMetin) {
            const aiBaslik = await baslikUret(ilkMetin);
            await sohbetiYenidenAdlandir(sahip, sohbetId, aiBaslik);
          }
        }
      },
      execute: async ({ writer }) => {
        const result = streamText({
          model,
          temperature,
          maxOutputTokens,
          stopWhen: stepCountIs(8),
          experimental_transform: [harmonyKacagiKoruyucusu, dayanaksizAtifKoruyucusu],
          system: sistemTalimati,
          messages: await convertToModelMessages(messages),
          tools: {
            kurumBelgelerindeAra: {
              description:
                "Kurumun bilgi tabanında (yöneticinin önceden yüklediği yönetmelik, genelge, iç prosedür belgeleri) arama yapar. Kurum belgelerine dayalı her soruda önce bunu çağır.",
              inputSchema: z.object({
                sorgu: z.string().describe("Aranacak konu veya anahtar kelimeler."),
              }),
              execute: async ({ sorgu }: { sorgu: string }) => {
                const sonuclar = await bilgiTabanindaAra(session.kurumId, sorgu);
                if (sonuclar.length === 0) {
                  return {
                    bulundu: false,
                    not: "Kurum bilgi tabanında eşleşen bir içerik yok. Uydurma cevap verme; bilgi olmadığını söyle.",
                    sonuclar: [],
                  };
                }
                return { bulundu: true, sonuclar };
              },
            },

            mevzuatAra: {
              description:
                "Mevzuat külliyatında (kanun/yönetmelik maddeleri) arama yapar. Hukuki dayanak gerektiren sorularda kullan.",
              inputSchema: z.object({
                sorgu: z.string().describe("Aranacak hukuki konu."),
              }),
              execute: async ({ sorgu }: { sorgu: string }) => {
                // A citizen has no institution — the anonymous session is
                // anchored to one only so its rows satisfy their foreign keys.
                // Scoping their search by it answered questions about a
                // bakanlık or valilik out of a belediye's corpus. Mevzuat is
                // public law; for them the whole corpus is in scope.
                const sonuclar = await mevzuatAraVektor(
                  vatandasMi ? null : session.kurumId,
                  sorgu,
                  5
                );
                return { bulundu: sonuclar.length > 0, sonuclar };
              },
            },

            sohbetEkindeAra: {
              description:
                "YALNIZCA bu sohbete yüklenmiş ek belgelerde arama yapar. Kullanıcı bu sohbete bir belge yüklediyse ve o belgeye dair soru sorduysa bunu çağır. Bu ekler kuruma kaydedilmez, sadece bu sohbete aittir.",
              inputSchema: z.object({
                sorgu: z.string().describe("Ek belgede aranacak konu."),
              }),
              execute: async ({ sorgu }: { sorgu: string }) => {
                const sonuclar = await sohbetEkindeAra(session.kurumId, sohbetId, sorgu);
                if (sonuclar.length === 0) {
                  return {
                    bulundu: false,
                    not: "Bu sohbete yüklenmiş eklerde eşleşen içerik yok.",
                    sonuclar: [],
                  };
                }
                return { bulundu: true, sonuclar };
              },
            },

            belgeTaslagiHazirla: {
              description:
                "Kullanıcı adına yeni bir resmi belge taslağı (dilekçe, tutanak, sözleşme, karar) oluşturur ve düzenleme tuvalinde açar. Vatandaşlar için YALNIZCA resmi dilekçe ('dilekce') oluşturulabilir; sözleşme, karar veya tutanak OLUŞTURULAMAZ.",
              inputSchema: z.object({
                belgeTuru: z.string().describe("dilekce, tutanak, sozlesme veya karar."),
                baslik: z.string().describe("Belgenin kısa başlığı."),
                baglam: z
                  .string()
                  .describe("Belgenin neye ilişkin olduğunu anlatan, sohbetten toplanmış ayrıntılı açıklama."),
                muhatap: z
                  .string()
                  .optional()
                  .describe(
                    "Belgenin hitap edeceği makam — yetkili kurum ve varsa birim (örn. “Millî Eğitim Bakanlığı Personel Genel Müdürlüğüne”, “Elazığ Valiliğine”). Hangi kurumun yetkili olduğundan emin değilsen BOŞ BIRAK; tahmin etme."
                  ),
              }),
              execute: async ({
                belgeTuru,
                baslik,
                baglam,
                muhatap,
              }: {
                belgeTuru: string;
                baslik: string;
                baglam: string;
                muhatap?: string;
              }) => {
                if (session.hiyerarsiSeviyesi === 0 && belgeTuru !== "dilekce") {
                  return {
                    basarili: false,
                    hata: "Vatandaşlar yalnızca resmi dilekçe ('dilekce') oluşturabilir. Sözleşme, karar veya tutanak oluşturma yetkisi bulunmamaktadır.",
                  };
                }
                const tur = belgeTuruGetir(belgeTuru);
                if (!tur) {
                  return { basarili: false, hata: `Bilinmeyen belge türü: ${belgeTuru}` };
                }
                if (session.hiyerarsiSeviyesi < tur.minHiyerarsiSeviyesi) {
                  return {
                    basarili: false,
                    hata: `"${tur.ad}" oluşturmak için gereken hiyerarşi seviyesi ${tur.minHiyerarsiSeviyesi}; kullanıcının seviyesi ${session.hiyerarsiSeviyesi}. Belge oluşturulmadı.`,
                  };
                }

                // Minted now rather than at insert time — this is also the
                // data part's id, so every write below updates ONE logical
                // part in place instead of appending a new one each time.
                const id = randomUUID();
                const goster = (govdeMetniSoFar: string, durum: BelgeCanliTaslakVerisi["durum"]) => {
                  try {
                    writer.write({
                      type: "data-belge-taslak",
                      id,
                      data: {
                        belgeId: id,
                        baslik,
                        turAdi: tur.ad,
                        govdeMetni: govdeMetniSoFar,
                        durum,
                      } satisfies BelgeCanliTaslakVerisi,
                    });
                  } catch (e) {
                    console.warn("Canlı taslak verisi gönderilemedi:", e);
                  }
                };

                try {
                  // Pop the canvas open now — before the belge-yazar LLM call
                  // even starts, let alone finishes.
                  goster("", "yazılıyor");

                  // For a citizen the author is the citizen, not an institution:
                  // passing kurum.ad here is what put "Örnek Belediye" on the
                  // letterhead of every dilekçe. The addressee comes from the
                  // model, which has just worked out with the citizen which
                  // institution is competent; when it does not know, the drafting
                  // prompt falls back to İLGİLİ MAKAMA rather than guessing.
                  const sonuc = await belgeTaslagiOlusturAkisli({
                    tur,
                    baglam,
                    kurumAdi: vatandasMi ? undefined : (kurum?.ad ?? "Kurum"),
                    muhatap: vatandasMi ? muhatap : (kurum?.ad ?? undefined),
                    kurumId: vatandasMi ? null : session.kurumId,
                    onIlerleme: (govdeMetniSoFar: string) => goster(govdeMetniSoFar, "yazılıyor"),
                  });

                  await db.insert(schema.belgeler).values({
                    id,
                    belgeTuru: tur.id,
                    baslik,
                    baglam,
                    govdeMetni: sonuc.govdeMetni,
                    kaynaklar: JSON.stringify(sonuc.kaynaklar),
                    olusturanKullaniciId: session.userId,
                    kurumId: session.kurumId,
                    birimId: session.birimId,
                    // Lets "Belgelerim" deep-link back to this conversation, and is
                    // how the canvas panel knows which chat "owns" the document.
                    sohbetId,
                  });
                  await db.insert(schema.auditLog).values({
                    islem: "belge_olusturuldu_asistan",
                    kullanici: session.kullaniciAdi,
                    detay: JSON.stringify({ belgeId: id, tur: tur.id }),
                  });

                  // Final frame uses the exact persisted string, so the live
                  // view's last frame and BelgeTuvali's first frame match.
                  goster(sonuc.govdeMetni, "tamam");

                  return {
                    basarili: true,
                    belgeId: id,
                    tur: tur.ad,
                    baslik,
                    baglanti: vatandasMi
                      ? `/basvuru/asistan/${sohbetId}?belge=${id}`
                      : `/panel/belge/${id}`,
                    // A change marker the canvas panel compares against what it last
                    // rendered, to know a tool touched "its" document and refresh.
                    surum: Date.now(),
                  };
                } catch (err) {
                  console.error("Belge oluşturma hatası:", err);
                  goster("Belge taslağı oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.", "tamam");
                  return {
                    basarili: false,
                    hata: "Belge taslağı oluşturulurken bir hata meydana geldi.",
                  };
                }
              },
            },

            evrakYenidenAnalizEt: {
              description:
                "Mevcut bir evrağın sınıflandırma ve mevzuat analizini yeniden çalıştırır. Yalnızca evrak henüz 'iç incelemede' aşamasındayken (memur onayı verilmeden önce) kullanılabilir. Kullanıcı bir evrağın yanlış sınıflandırıldığını veya analizin eksik olduğunu söylerse çağır.",
              inputSchema: z.object({
                takipNo: z.string().describe("Evrağın takip numarası veya kayıt numarası."),
              }),
              execute: async ({ takipNo }: { takipNo: string }) => {
                const [evrak] = await db
                  .select()
                  .from(schema.evraklar)
                  .where(
                    and(
                      or(eq(schema.evraklar.takipNo, takipNo), eq(schema.evraklar.kayitNo, takipNo)),
                      eq(schema.evraklar.kurumId, session.kurumId)
                    )
                  );
                if (!evrak) return { basarili: false, hata: `Evrak bulunamadı: ${takipNo}` };

                // Same scoping the evrak detail page enforces — re-checked here so
                // the chat cannot reach another birim's cases.
                if (evrak.birimId !== session.birimId) {
                  return { basarili: false, hata: "Bu evrak sizin biriminize ait değil." };
                }
                // Past this stage a human has already confirmed the analysis;
                // rerunning it would silently overwrite their decision.
                if (evrak.durum !== "ic_incelemede") {
                  return {
                    basarili: false,
                    hata: `Evrak "${evrak.durum}" durumunda. Yeniden analiz yalnızca 'ic_incelemede' aşamasında yapılabilir.`,
                  };
                }

                const siniflandirma = await siniflandirDilekce(evrak.rawText);
                const okuma = await evrakiOku(
                  evrak.rawText,
                  siniflandirma.evrakTuru,
                  session.kurumId
                );

                await db
                  .update(schema.evraklar)
                  .set({
                    evrakTuru: siniflandirma.evrakTuru,
                    sdpKodu: siniflandirma.sdpKodu,
                    confidence: siniflandirma.confidence,
                    analizOzeti: okuma.ozet,
                    onceligi: okuma.onceligi,
                    mevzuatEslesmeleri: JSON.stringify(okuma.mevzuatEslesmeleri),
                    guncellemeZamani: new Date(),
                  })
                  .where(eq(schema.evraklar.id, evrak.id));

                await db.insert(schema.auditLog).values({
                  evrakId: evrak.id,
                  islem: "yeniden_analiz_asistan",
                  kullanici: session.kullaniciAdi,
                  detay: JSON.stringify({ evrakTuru: siniflandirma.evrakTuru }),
                });

                return {
                  basarili: true,
                  takipNo: evrak.takipNo,
                  evrakTuru: siniflandirma.evrakTuru,
                  ozet: okuma.ozet,
                  mevzuatEslesmeleri: okuma.mevzuatEslesmeleri,
                  baglanti: `/panel/evrak/${evrak.id}`,
                };
              },
            },

            evrakTaslakOnerisiOlustur: {
              description:
                "Mevcut bir evrağın yanıt yazısı için yeni bir AI önerisi hazırlar. Öneri doğrudan uygulanmaz; evrak sayfasında yetkilinin onayını bekler. Kullanıcı bir evrağın yazısının yeniden yazılmasını veya iyileştirilmesini isterse çağır.",
              inputSchema: z.object({
                takipNo: z.string().describe("Evrağın takip numarası veya kayıt numarası."),
                talimat: z
                  .string()
                  .describe("Yazının nasıl değiştirilmesi istendiği. Özel bir talep yoksa boş bırak.")
                  .optional(),
              }),
              execute: async ({ takipNo, talimat }: { takipNo: string; talimat?: string }) => {
                const [evrak] = await db
                  .select()
                  .from(schema.evraklar)
                  .where(
                    and(
                      or(eq(schema.evraklar.takipNo, takipNo), eq(schema.evraklar.kayitNo, takipNo)),
                      eq(schema.evraklar.kurumId, session.kurumId)
                    )
                  );
                if (!evrak) return { basarili: false, hata: `Evrak bulunamadı: ${takipNo}` };
                if (evrak.birimId !== session.birimId) {
                  return { basarili: false, hata: "Bu evrak sizin biriminize ait değil." };
                }

                const taslak = evrak.taslakYapisi ? JSON.parse(evrak.taslakYapisi) : null;
                const mevcutGovde: string = taslak?.govdeMetni ?? "";

                const oneri = await belgeOnerisiOlustur({
                  belgeTuruAdi: "resmi yanıt yazısı",
                  icerikRehberi:
                    "Vatandaş başvurusuna kurum adına verilen resmi yanıt. Talebi karşıla, hukuki dayanağı belirt, sonucu açıkça yaz.",
                  mevcutGovde,
                  baglam: `${evrak.analizOzeti ?? ""}\n\nBaşvuru metni: ${evrak.rawText}`,
                  talimat: talimat ?? "",
                  kurumId: session.kurumId,
                });

                if (!oneri) {
                  return {
                    basarili: false,
                    hata: "Yeni bir öneri üretilemedi veya mevcut metinden farklı bir sonuç çıkmadı.",
                  };
                }

                // Written to the suggestion table, exactly like every other AI
                // edit — a person still has to accept it on the evrak page.
                await db.insert(schema.belgeOnerileri).values({
                  hedefTuru: "evrak",
                  hedefId: evrak.id,
                  oncekiMetin: mevcutGovde,
                  oneriMetin: oneri.govdeMetni,
                  gerekce: oneri.gerekce,
                  kaynak: "ai",
                  olusturanKullaniciId: session.userId,
                });

                await db.insert(schema.auditLog).values({
                  evrakId: evrak.id,
                  islem: "taslak_onerisi_asistan",
                  kullanici: session.kullaniciAdi,
                  detay: JSON.stringify({ talimat: talimat ?? "" }),
                });

                return {
                  basarili: true,
                  takipNo: evrak.takipNo,
                  gerekce: oneri.gerekce,
                  not: "Öneri kaydedildi ve evrak sayfasında onay bekliyor. Yazıya doğrudan uygulanmadı.",
                  baglanti: `/panel/evrak/${evrak.id}`,
                };
              },
            },

            belgeRevizyonuOner: {
              description:
                "Mevcut bir belgenin tamamı için yapay zeka destekli bir revizyon önerisi hazırlar. Öneri belgeye DOĞRUDAN YAZILMAZ — tuvaldeki öneri kartında kullanıcının kabul/red kararını bekler. Kullanıcı bir belgenin yeniden yazılmasını, kısaltılmasını, iyileştirilmesini vb. isterse çağır.",
              inputSchema: z.object({
                belgeId: z.string().describe("Revizyon önerilecek belgenin kimliği."),
                talimat: z.string().describe("Neyin nasıl değişmesi istendiği."),
              }),
              execute: async ({ belgeId, talimat }: { belgeId: string; talimat: string }) => {
                const sonuc = await belgeRevizyonuOnerAction({
                  belgeId,
                  talimat,
                  kullaniciAdi: session.kullaniciAdi,
                  birimId: session.birimId,
                });
                if (!sonuc.basarili) return sonuc;
                return { ...sonuc, belgeId, surum: Date.now() };
              },
            },

            belgeyiOnayaGonder: {
              description:
                "Tamamlanmış bir belgeyi biriminin onay zincirine gönderir. ONAYLAMANIN KENDİSİNİ YAPMAZ — onaylama yalnızca tuvaldeki düğmeyle yetkili kişi tarafından yapılabilir; bu araç yalnızca zinciri başlatır. Kullanıcı bir belgeyi onaya göndermek istediğini açıkça söylerse çağır.",
              inputSchema: z.object({
                belgeId: z.string().describe("Onaya gönderilecek belgenin kimliği."),
              }),
              execute: async ({ belgeId }: { belgeId: string }) => {
                // The action reports its refusals as data now, so the model gets
                // the real reason ("not finished yet", "resolve the pending
                // suggestions first") instead of a generic failure. A genuine
                // defect still throws, and the catch keeps it out of the stream.
                try {
                  const sonuc = await belgeyiOnayaGonderAction(belgeId);
                  if (!sonuc.basarili) return { basarili: false, hata: sonuc.hata };
                  return {
                    basarili: true,
                    belgeId,
                    surum: Date.now(),
                    not: "Belge onay zincirine gönderildi. Onaylama işlemini yetkili kişiler tuvalden yapacak.",
                  };
                } catch (err) {
                  console.error("belgeyiOnayaGonder aracı başarısız:", { belgeId, hata: err });
                  return { basarili: false, hata: "Belge onaya gönderilemedi." };
                }
              },
            },

            belgeyiSiniflandir: {
              description:
                "Bir belgenin hangi kurum/birime ait olması gerektiğini yapay zeka ile önerir. HİÇBİR ŞEY YAZMAZ VEYA HAVALE ETMEZ — yalnızca bir öneri döndürür; kullanıcı tuvaldeki 'Havale Et' formunu onaylarsa gerçekleşir. Kullanıcı bir belgenin doğru yere yönlendirilip yönlendirilmediğini sorarsa çağır.",
              inputSchema: z.object({
                belgeId: z.string().describe("Sınıflandırılacak belgenin kimliği."),
              }),
              execute: async ({ belgeId }: { belgeId: string }) => {
                const [belge] = await db.select().from(schema.belgeler).where(eq(schema.belgeler.id, belgeId));
                if (!belge) return { basarili: false, hata: "Belge bulunamadı." };
                if (belge.birimId !== session.birimId) {
                  return { basarili: false, hata: "Bu belge sizin biriminize ait değil." };
                }

                const siniflandirma = await siniflandirDilekce(
                  `${belge.baslik}\n\n${belge.baglam}\n\n${belge.govdeMetni}`
                );
                const [hedefKurum] = await db
                  .select()
                  .from(schema.kurumlar)
                  .where(eq(schema.kurumlar.id, siniflandirma.kurumId));
                const [hedefBirim] = await db
                  .select()
                  .from(schema.birimler)
                  .where(eq(schema.birimler.id, siniflandirma.birimId));

                return {
                  basarili: true,
                  belgeId,
                  onerilenKurumAdi: hedefKurum?.ad ?? siniflandirma.kurumId,
                  onerilenBirimAdi: hedefBirim?.ad ?? siniflandirma.birimId,
                  guvenSkoru: siniflandirma.confidence,
                  not: "Bu yalnızca bir öneridir; hiçbir şey değiştirilmedi. Uygulamak için kullanıcı tuvaldeki Havale Et formunu kullanmalı.",
                };
              },
            },

            evrakYanitAdayiBul: {
              description:
                "Bu birimde açık olan (henüz onay zincirine girmemiş) evrakları listeler — bir belgeyi hangi evrağa yanıt olarak bağlayabileceğinizi bulmak için. HİÇBİR ŞEYİ BAĞLAMAZ; yalnızca aday listesi döner. Bağlama işlemi tuvaldeki 'Evraka Bağla' formuyla yapılır.",
              inputSchema: z.object({}),
              execute: async () => {
                const adaylar = await evrakYanitAdaylariGetir(session.birimId);
                if (adaylar.length === 0) {
                  return { bulundu: false, not: "Bu birimde açık evrak yok.", adaylar: [] };
                }
                return {
                  bulundu: true,
                  adaylar: adaylar.map((a) => ({ ...a, baglanti: `/panel/evrak/${a.id}` })),
                };
              },
            },
          },
        });

        writer.merge(toUIMessageStream({ stream: result.stream, onError: guvenliHataMesaji }));
      },
    }),
  });
}
