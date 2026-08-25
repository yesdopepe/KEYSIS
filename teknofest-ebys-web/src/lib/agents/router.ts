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
    return {
      evrakTuruId: secilen.id,
      evrakTuru: secilen.evrakTuru,
      kurumId: secilen.kurumId,
      kurumAdi: secilen.kurumAdi,
      birimId: secilen.birimId,
      sdpKodu: "",
      confidence: object.confidence,
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
