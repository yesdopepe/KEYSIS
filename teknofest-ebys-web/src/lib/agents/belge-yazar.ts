import "server-only";
import { z } from "zod";
import { generateObject, streamObject } from "ai";
import { getAgentModel } from "@/lib/ai/client";
import { loadPrompt } from "@/lib/ai/prompt";
import { mevzuatAraVektor } from "@/lib/mevzuat";
import type { BelgeTuruTanimi } from "@/lib/belgeler/turler";

export interface BelgeKaynagi {
  referans: string;
  aciklama: string;
  /** In-app link to the cited article; absent for non-mevzuat citations. */
  link?: string;
}

export interface BelgeTaslakSonucu {
  govdeMetni: string;
  kaynaklar: BelgeKaynagi[];
}

const Sema = z.object({
  govde_metni: z.string(),
  kaynaklar: z.array(z.object({ referans: z.string(), aciklama: z.string() })),
});

/**
 * Drafts a staff-authored internal document (tutanak/sözleşme/karar). The
 * agent is not constrained to a fixed field template — it decides the
 * document's own internal structure (section headings, if any, marked with
 * "## ") the way a person writing it by hand would, guided only by
 * `tur.icerikRehberi`. Citations point back to the specific mevzuat
 * maddesi each substantive part is derived from — the concrete answer to
 * "there must be citations to the original text it was derived from" for
 * this kind of document.
 *
 * Streams the body text as it's generated via `onIlerleme`, so a caller can
 * forward live progress (e.g. to a canvas panel) instead of waiting for the
 * whole document to finish — the tradeoff is `streamObject` rather than
 * `generateObject`, otherwise identical prompt/lookup/fallback behavior.
 */
export async function belgeTaslagiOlusturAkisli(
  tur: BelgeTuruTanimi,
  baglam: string,
  kurumAdi: string,
  kurumId: string,
  onIlerleme?: (govdeMetniSoFar: string) => void
): Promise<BelgeTaslakSonucu> {
  const adaylar = await mevzuatAraVektor(kurumId, baglam, 6);
  const adayMetni = adaylar
    .map((a) => `- kodu: "${a.kodu}" | başlık: ${a.baslik} | özet: ${a.icerik}`)
    .join("\n");

  const varsayilanGovde = `[EK BİLGİ GEREKLİ: bu belge AI tarafından oluşturulamadı]`;

  try {
    const { model, temperature, maxOutputTokens } = getAgentModel("belge_yazar_agent");
    const { partialObjectStream, object } = streamObject({
      model,
      temperature,
      maxOutputTokens,
      schema: Sema,
      prompt: loadPrompt("belge-yazar-agent", {
        belge_turu_adi: tur.ad,
        belge_turu_aciklamasi: tur.aciklama,
        icerik_rehberi: tur.icerikRehberi,
        kurum_adi: kurumAdi,
        baglam,
        mevzuat_adaylari: adayMetni || "(aday madde bulunamadı)",
      }),
    });

    let sonBildirilen = "";
    for await (const partial of partialObjectStream) {
      const metin = partial.govde_metni;
      if (typeof metin === "string" && metin.length > 0 && metin !== sonBildirilen) {
        sonBildirilen = metin;
        onIlerleme?.(metin);
      }
    }

    const nihaiNesne = await object;
    const govdeMetni = nihaiNesne.govde_metni.trim() || varsayilanGovde;

    // Only citations the model was actually shown survive — and each carries
    // the link to its article so a reader can open the source text.
    const linkler = new Map(adaylar.map((a) => [a.kodu, a.link]));
    const kaynaklar: BelgeKaynagi[] = nihaiNesne.kaynaklar
      .filter((k) => linkler.has(k.referans))
      .map((k) => ({ ...k, link: linkler.get(k.referans) }));

    return { govdeMetni, kaynaklar };
  } catch (err) {
    console.warn("Belge yazar LLM çağrısı başarısız:", err);
    return { govdeMetni: varsayilanGovde, kaynaklar: [] };
  }
}

const BelgeOnerisiSemasi = z.object({
  govde_metni: z.string(),
  gerekce: z.string(),
});

export interface BelgeOnerisi {
  govdeMetni: string;
  gerekce: string;
}

/**
 * Revises the whole document body based on a free-text instruction and
 * returns a full replacement — not a fixed-field patch. This is written to
 * the suggestion table for a human to accept or reject, exactly like the
 * initial draft is never applied directly.
 */
export async function belgeOnerisiOlustur(params: {
  belgeTuruAdi: string;
  icerikRehberi: string;
  mevcutGovde: string;
  baglam: string;
  talimat: string;
  kurumId: string;
}): Promise<BelgeOnerisi | null> {
  const adaylar = await mevzuatAraVektor(
    params.kurumId,
    `${params.baglam} ${params.talimat} ${params.mevcutGovde}`,
    5
  );
  const adayMetni = adaylar
    .map((a) => `- kodu: "${a.kodu}" | başlık: ${a.baslik} | özet: ${a.icerik}`)
    .join("\n");

  try {
    const { model, temperature, maxOutputTokens } = getAgentModel("belge_yazar_agent");
    const { object } = await generateObject({
      model,
      temperature,
      maxOutputTokens,
      schema: BelgeOnerisiSemasi,
      prompt: loadPrompt("belge-onerisi-agent", {
        belge_turu_adi: params.belgeTuruAdi,
        icerik_rehberi: params.icerikRehberi,
        mevcut_govde: params.mevcutGovde || "(belge henüz boş)",
        baglam: params.baglam,
        talimat: params.talimat || "(özel bir talep yok — resmiyet, açıklık ve bütünlük açısından iyileştir)",
        mevzuat_adaylari: adayMetni || "(aday madde bulunamadı)",
      }),
    });

    const govdeMetni = object.govde_metni.trim();
    // A suggestion identical to what is already there is noise, not review
    // material — surfacing it would train reviewers to click through.
    if (!govdeMetni || govdeMetni === params.mevcutGovde.trim()) return null;

    return { govdeMetni, gerekce: object.gerekce.trim() };
  } catch (err) {
    console.warn("Belge önerisi LLM çağrısı başarısız:", err);
    return null;
  }
}
