import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { getAgentModel } from "@/lib/ai/client";
import { loadPrompt } from "@/lib/ai/prompt";

export interface GerekliAlan {
  alan: string;
  aciklama: string;
  zorunlu: boolean;
}

export interface EksikAlan {
  alan: string;
  soru: string;
}

const Sema = z.object({
  eksik_alanlar: z.array(
    z.object({
      alan: z.string(),
      soru: z.string(),
    })
  ),
});

/**
 * Checks a dilekçe against its evrakTuru's required-field schema and
 * returns what's missing, each with a citizen-facing follow-up question —
 * this is what makes the şartname's "eksik bilgi tespiti/talep etme"
 * requirement concrete, driven by the same yazışma şablonu the Writer
 * agent later drafts against.
 */
export async function eksikBilgiTespitEt(
  dilekceMetni: string,
  gerekliAlanlar: GerekliAlan[]
): Promise<EksikAlan[]> {
  const zorunluAlanlar = gerekliAlanlar.filter((a) => a.zorunlu);
  if (zorunluAlanlar.length === 0) return [];

  try {
    const { model, temperature, maxOutputTokens } = getAgentModel("eksik_bilgi_agent");
    const { object } = await generateObject({
      model,
      temperature,
      maxOutputTokens,
      schema: Sema,
      prompt: loadPrompt("eksik-bilgi-agent", {
        dilekce_metni: dilekceMetni,
        gerekli_alanlar: zorunluAlanlar
          .map((a) => `- ${a.alan}: ${a.aciklama} (zorunlu: ${a.zorunlu})`)
          .join("\n"),
      }),
    });
    return object.eksik_alanlar;
  } catch (err) {
    console.warn("Eksik bilgi tespiti LLM çağrısı başarısız:", err);
    // Fail safe: assume nothing detectably missing rather than blocking the
    // citizen's submission on an infrastructure error.
    return [];
  }
}
