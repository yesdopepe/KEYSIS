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

/**
 * Floor below which a mevzuat match is discarded outright.
 *
 * Deliberately low, because on this corpus similarity cannot separate related
 * from unrelated on its own. Measured after the full re-index: correct matches
 * land at 0.755 (4982/11 for a bilgi-edinme request), 0.648 (2872/8 for a
 * refuse complaint) and 0.584 (5393/15 for a pavement repair) — while
 * unrelated teacher-overtime articles reach 0.604 on an unrelated query. The
 * bands overlap, so any line high enough to exclude the noise also vetoes a
 * genuine match, and vice versa.
 *
 * What actually discriminates is the Reader's own selection: given six
 * candidates it now names the one article that applies, and names none when
 * nothing does. This floor only removes results too weak for that judgement to
 * be worth trusting.
 */
export const MEVZUAT_GUVEN_ESIGI = 0.45;

/**
 * Keeps only matches confident enough to show. Applied both when the Reader
 * writes them and when a page reads them back, so cases filed before the
 * threshold existed are filtered too.
 */
export function guvenilirMevzuatEslesmeleri(eslesmeler: MevzuatEslesmesi[]): MevzuatEslesmesi[] {
  return eslesmeler.filter((m) => m.benzerlikSkoru >= MEVZUAT_GUVEN_ESIGI);
}

export interface OkumaSonucu {
  /**
   * Null when the analysis could not be produced. It used to fall back to the
   * first 200 characters of the petition, which the case file then displayed
   * under "AI Analizi" as though a model had written it — indistinguishable
   * from a real summary, so a total outage looked like normal operation.
   */
  ozet: string | null;
  onceligi: "normal" | "acil" | "gunlu";
  mevzuatEslesmeleri: MevzuatEslesmesi[];
  anahtarBilgiler: Record<string, string>;
}

/**
 * `anahtar_bilgiler` is a list of pairs rather than the open-ended map this
 * once used (`z.record`). That map compiles to a JSON Schema with
 * `additionalProperties`, which EVREN's guided decoding rejects outright: every
 * call returned HTTP 500, three retries deep, so *every* case since had a
 * sliced-text summary, "normal" priority and no real mevzuat reading. The pair
 * list is expressible in the same schema dialect and the identical prompt then
 * succeeds — so keep this shape closed; an open map silently disables the agent.
 */
const Sema = z.object({
  ozet: z.string(),
  oncelik: z.enum(["normal", "acil", "gunlu"]),
  ilgili_mevzuat_kodlari: z.array(z.string()),
  anahtar_bilgiler: z.array(z.object({ anahtar: z.string(), deger: z.string() })),
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
      // Two conditions, not one: the model picked it *and* the retrieval score
      // backs the pick. A model asked "which of these six apply" will name
      // something rather than none.
      mevzuatEslesmeleri: guvenilirMevzuatEslesmeleri(eslesmeler),
      anahtarBilgiler: Object.fromEntries(
        object.anahtar_bilgiler.map((b) => [b.anahtar, b.deger])
      ),
    };
  } catch (err) {
    // Loud, because the failure is otherwise invisible: nothing downstream
    // distinguishes "no analysis" from "nothing noteworthy in this case".
    console.error("Reader agent başarısız — evrak analizsiz kaydediliyor:", err);
    return {
      ozet: null,
      onceligi: "normal",
      // No fallback to the top vector hits. Nothing read the case here, so
      // there is no judgement that these articles are related — listing the
      // nearest three anyway is what put unrelated mevzuat on case files.
      mevzuatEslesmeleri: [],
      anahtarBilgiler: {},
    };
  }
}
