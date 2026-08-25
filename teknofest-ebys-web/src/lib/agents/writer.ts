import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { getAgentModel } from "@/lib/ai/client";
import { loadPrompt } from "@/lib/ai/prompt";
import { bosYanitTaslagi, type YanitTaslagi } from "@/lib/belgeler/yanit-taslagi";
import type { MevzuatEslesmesi } from "./reader";

const Sema = z.object({
  konu: z.string(),
  hitap: z.string(),
  govde_metni: z.string(),
});

/**
 * Writer agent (Görev 2): drafts the official response using the case's
 * yazışma şablonu drafting rules — the same template record that drove
 * missing-info detection earlier, so the required-fields schema and the
 * drafting style stay in one place instead of duplicated across prompts.
 * The body is one flowing text the model writes freely (İlgi reference,
 * paragraphs, closing formula all included as natural prose) rather than
 * being forced into separate named fields.
 */
export async function taslakOlustur(params: {
  kurumAdi: string;
  basvuruSahibi: string;
  ozet: string;
  dilekceMetni: string;
  mevzuatEslesmeleri: MevzuatEslesmesi[];
  taslakKurallari: string;
}): Promise<YanitTaslagi> {
  const { model, temperature, maxOutputTokens } = getAgentModel("writer_agent");

  const mevzuatMetni =
    params.mevzuatEslesmeleri.length > 0
      ? params.mevzuatEslesmeleri.map((m) => `- ${m.maddeKodu}: ${m.baslik}`).join("\n")
      : "(ilgili mevzuat bulunamadı)";

  try {
    const { object } = await generateObject({
      model,
      temperature,
      maxOutputTokens,
      schema: Sema,
      prompt: loadPrompt("writer-agent", {
        kurum_adi: params.kurumAdi,
        basvuru_sahibi: params.basvuruSahibi,
        ozet: params.ozet,
        dilekce_metni: params.dilekceMetni,
        mevzuat_eslesmeleri: mevzuatMetni,
        taslak_kurallari: params.taslakKurallari,
      }),
    });
    const govdeMetni = object.govde_metni.trim();
    if (!govdeMetni) throw new Error("Taslak gövdesi boş döndü.");
    return { konu: object.konu, hitap: object.hitap, govdeMetni };
  } catch (err) {
    console.warn("Writer LLM çağrısı başarısız, şablon taslakla devam ediliyor:", err);
    return {
      ...bosYanitTaslagi(),
      konu: "Başvurunuz Hakkında",
      hitap: `Sayın ${params.basvuruSahibi}`,
      govdeMetni: [
        `İlgi : Tarafınızca kurumumuza yapılan başvuru.`,
        ``,
        `İlgi başvurunuzda belirttiğiniz "${params.ozet}" konusu kurumumuzca değerlendirmeye alınmıştır.`,
        ``,
        `Başvurunuz ilgili birimimize havale edilmiş olup, inceleme sonucuna ilişkin bilgilendirme tarafınıza ayrıca iletilecektir.`,
        ``,
        `Bilgilerinize rica ederim.`,
      ].join("\n"),
    };
  }
}
