import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getAgentModel } from "@/lib/ai/client";
import { loadPrompt } from "@/lib/ai/prompt";
import { enIyiEslesmeler } from "@/lib/search/metin-benzerligi";

export interface SiniflandirmaSonucu {
  evrakTuruId: string;
  evrakTuru: string;
  kurumId: string;
  kurumAdi: string;
  birimId: string;
  sdpKodu: string;
  confidence: number;
  aciklama: string;
}

interface AdaySablon {
  id: string;
  evrakTuru: string;
  ad: string;
  kurumId: string;
  kurumAdi: string;
  birimId: string;
  gerekliAlanlar: string;
  // From taslakKurallari — for a hand-authored template this is drafting
  // style guidance (not shown here previously); for a birim's catch-all
  // template (see lib/birimler.ts) this IS the admin's own description of
  // what the department handles, so it must reach the classifier or the
  // whole point of writing that description is defeated.
  yonlendirmeNotu: string;
}

async function adaySablonlariGetir(): Promise<AdaySablon[]> {
  const rows = await db
    .select({
      id: schema.yazismaSablonlari.id,
      evrakTuru: schema.yazismaSablonlari.evrakTuru,
      ad: schema.yazismaSablonlari.ad,
      gerekliAlanlar: schema.yazismaSablonlari.gerekliAlanlar,
      ilgiliBirimKodu: schema.yazismaSablonlari.ilgiliBirimKodu,
      kurumId: schema.yazismaSablonlari.kurumId,
      kurumAdi: schema.kurumlar.ad,
      taslakKurallari: schema.yazismaSablonlari.taslakKurallari,
    })
    .from(schema.yazismaSablonlari)
    .innerJoin(schema.kurumlar, eq(schema.yazismaSablonlari.kurumId, schema.kurumlar.id));

  const birimler = await db.select().from(schema.birimler);

  return rows.map((r) => {
    const birim = birimler.find(
      (b) => b.kurumId === r.kurumId && b.kod === r.ilgiliBirimKodu
    );
    return {
      id: r.id,
      evrakTuru: r.evrakTuru,
      ad: r.ad,
      kurumId: r.kurumId,
      kurumAdi: r.kurumAdi,
      birimId: birim?.id ?? "",
      gerekliAlanlar: r.gerekliAlanlar,
      yonlendirmeNotu: (r.taslakKurallari ?? "").slice(0, 200),
    };
  });
}

function adayListesiMetni(adaylar: AdaySablon[]): string {
  return adaylar
    .map(
      (a) =>
        `- id: "${a.id}" | tür: ${a.ad} | kurum: ${a.kurumAdi} | gerekli alanlar: ${JSON.parse(a.gerekliAlanlar).map((g: { alan: string }) => g.alan).join(", ")} | notlar: ${a.yonlendirmeNotu}`
    )
    .join("\n");
}

const SonucSemasi = z.object({
  aciklama: z.string(),
  confidence: z.number().min(0).max(1),
});

/**
 * Ceilings applied to the model's self-reported confidence, by whether an
 * independent signal agrees with its choice.
 *
 * The self-report on its own is not a measurement: across every case filed so
 * far it came back as exactly 0.95 — including one where a kimlik kartı
 * renewal was filed as "genel başvuru". A number that never varies cannot do
 * the job the prompt asks of it ("düşük confidence bir memurun elle kontrol
 * etmesini tetikler"), because the trigger never fires.
 *
 * The lexical ranking over the same candidate templates is computed here
 * anyway, so it costs nothing to ask whether it agrees. Agreement between two
 * methods that fail differently is evidence; one model's opinion of itself is
 * not. The model can still report *lower* than the ceiling — this only caps.
 */
const MUTABAKAT_TAVANLARI = {
  /** Lexical ranking's own top pick. */
  birinci: 0.95,
  /** Somewhere in the lexical top three. */
  ilkUcte: 0.75,
  /** The lexical ranking does not favour this template at all. */
  ayrisiyor: 0.5,
} as const;

function mutabakatTavani(secilenId: string, siralamaIdleri: string[]): number {
  const sira = siralamaIdleri.indexOf(secilenId);
  if (sira === 0) return MUTABAKAT_TAVANLARI.birinci;
  if (sira > 0 && sira < 3) return MUTABAKAT_TAVANLARI.ilkUcte;
  return MUTABAKAT_TAVANLARI.ayrisiyor;
}

/**
 * Classifies a citizen's dilekçe into the correct (kurum, birim, evrakTuru)
 * by having the LLM pick among the known yazışma şablonları — constrained
 * choice, not free generation, so it can't hallucinate an institution that
 * doesn't exist. Falls back to lexical similarity if the LLM call fails.
 */
export async function siniflandirDilekce(
  dilekceMetni: string
): Promise<SiniflandirmaSonucu> {
  const adaylar = await adaySablonlariGetir();
  if (adaylar.length === 0) {
    throw new Error("Sistemde tanımlı hiçbir yazışma şablonu yok.");
  }

  const lexikalSiralama = enIyiEslesmeler(
    dilekceMetni,
    adaylar,
    (a) => `${a.ad} ${a.yonlendirmeNotu} ${JSON.parse(a.gerekliAlanlar).map((g: { alan: string; aciklama: string }) => `${g.alan} ${g.aciklama}`).join(" ")}`,
    adaylar.length
  );
  const enIyiLexikal = lexikalSiralama[0]?.aday ?? adaylar[0];

  try {
    const { model, temperature, maxOutputTokens } = getAgentModel("router_agent");
    const ids = adaylar.map((a) => a.id) as [string, ...string[]];

    const { object } = await generateObject({
      model,
      temperature,
      maxOutputTokens,
      schema: z.object({
        evrak_turu_id: z.enum(ids),
        confidence: SonucSemasi.shape.confidence,
        aciklama: SonucSemasi.shape.aciklama,
      }),
      prompt: loadPrompt("router-agent", {
        dilekce_metni: dilekceMetni,
        aday_listesi: adayListesiMetni(adaylar),
      }),
    });

    const secilen = adaylar.find((a) => a.id === object.evrak_turu_id) ?? enIyiLexikal;
    const tavan = mutabakatTavani(
      secilen.id,
      lexikalSiralama.map((l) => l.aday.id)
    );

    return {
      evrakTuruId: secilen.id,
      evrakTuru: secilen.evrakTuru,
      kurumId: secilen.kurumId,
      kurumAdi: secilen.kurumAdi,
      birimId: secilen.birimId,
      sdpKodu: "",
      confidence: Math.min(object.confidence, tavan),
      aciklama: object.aciklama,
    };
  } catch (err) {
    console.warn("Router LLM çağrısı başarısız, lexikal sonuçla devam ediliyor:", err);
    return {
      evrakTuruId: enIyiLexikal.id,
      evrakTuru: enIyiLexikal.evrakTuru,
      kurumId: enIyiLexikal.kurumId,
      kurumAdi: enIyiLexikal.kurumAdi,
      birimId: enIyiLexikal.birimId,
      sdpKodu: "",
      confidence: Math.min(lexikalSiralama[0]?.skor ?? 0.3, 0.6),
      aciklama: "LLM kullanılamadı — anahtar kelime benzerliğine göre sınıflandırıldı.",
    };
  }
}
