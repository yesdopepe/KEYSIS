import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { getAgentModel } from "@/lib/ai/client";
import { loadPrompt } from "@/lib/ai/prompt";
import { mevzuatAraVektor } from "@/lib/mevzuat";

export interface MevzuatEslesmesi {
  maddeKodu: string;
  baslik: string;
  icerikOzeti: string;
  benzerlikSkoru: number;
  /** In-app link to the cited article, so the reader can open the source. */
  link?: string;
}

export interface OkumaSonucu {
  ozet: string;
  onceligi: "normal" | "acil" | "gunlu";
  mevzuatEslesmeleri: MevzuatEslesmesi[];
  anahtarBilgiler: Record<string, string>;
}

const Sema = z.object({
  ozet: z.string(),
  oncelik: z.enum(["normal", "acil", "gunlu"]),
  ilgili_mevzuat_kodlari: z.array(z.string()),
  anahtar_bilgiler: z.record(z.string(), z.string()),
});

/**
 * Reader agent: content analysis, mevzuat RAG (vector top-k over the madde
 * corpus, scoped to the case's kurum plus kurum-agnostic maddeler), and
 * summary generation — the remaining pieces of Görev 1 beyond
 * classification.
 */
export async function evrakiOku(
  dilekceMetni: string,
  evrakTuru: string,
  kurumId: string
): Promise<OkumaSonucu> {
  const adaylar = await mevzuatAraVektor(kurumId, dilekceMetni, 6);

  const adayMetni = adaylar
    .map((a) => `- kodu: "${a.kodu}" | başlık: ${a.baslik} | özet: ${a.icerik}`)
    .join("\n");

  const varsayilanOzet = dilekceMetni.slice(0, 200);

  try {
    const { model, temperature, maxOutputTokens } = getAgentModel("reader_agent");
    const { object } = await generateObject({
      model,
      temperature,
      maxOutputTokens,
      schema: Sema,
      prompt: loadPrompt("reader-agent", {
        dilekce_metni: dilekceMetni,
        evrak_turu: evrakTuru,
        mevzuat_adaylari: adayMetni || "(aday madde bulunamadı)",
      }),
    });

    const eslesmeler: MevzuatEslesmesi[] = object.ilgili_mevzuat_kodlari
      .map((kod): MevzuatEslesmesi | null => {
        const madde = adaylar.find((a) => a.kodu === kod);
        if (!madde) return null;
        return {
          maddeKodu: madde.kodu,
          baslik: madde.baslik,
          icerikOzeti: madde.icerik,
          benzerlikSkoru: madde.skor,
          link: madde.link,
        };
      })
      .filter((x): x is MevzuatEslesmesi => x !== null);

    return {
      ozet: object.ozet,
      onceligi: object.oncelik,
      mevzuatEslesmeleri: eslesmeler,
      anahtarBilgiler: object.anahtar_bilgiler,
    };
  } catch (err) {
    console.warn("Reader LLM çağrısı başarısız, vektör sonucuyla devam ediliyor:", err);
    return {
      ozet: varsayilanOzet,
      onceligi: "normal",
      mevzuatEslesmeleri: adaylar.slice(0, 3).map((a) => ({
        maddeKodu: a.kodu,
        baslik: a.baslik,
        icerikOzeti: a.icerik,
        benzerlikSkoru: a.skor,
        link: a.link,
      })),
      anahtarBilgiler: {},
    };
  }
}
