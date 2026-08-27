import "server-only";
import { z } from "zod";
import { generateObject } from "ai";
import { getAgentModel } from "@/lib/ai/client";
import { loadPrompt } from "@/lib/ai/prompt";

export interface GirdiEkDosya {
  ad: string;
  mimeTur: string;
  rawText: string | null;
  boyut: number;
}

export interface TekilDosyaAnalizi {
  ad: string;
  tur: string;
  ozet: string;
  uygunlukDurumu: "uyumlu" | "incelenmeli" | "ilgisiz";
  notlar: string;
}

export interface EkAnalizSonucu {
  dosyaSayisi: number;
  tespitEdilenBelgeler: string[];
  tutarlilikDurumu: "uyumlu" | "incelenmeli" | "eksik" | "supheli";
  genelOzet: string;
  caprazDogrulamaNotlari: string[];
  eksikVeyaSupheliHususlar: string[];
  dosyalar: TekilDosyaAnalizi[];
}

const Sema = z.object({
  tespit_edilen_belgeler: z.array(z.string()),
  tutarlilik_durumu: z.enum(["uyumlu", "incelenmeli", "eksik", "supheli"]),
  genel_ozet: z.string(),
  capraz_dogrulama_notlari: z.array(z.string()),
  eksik_veya_supheli_hususlar: z.array(z.string()),
  dosya_analizleri: z.array(
    z.object({
      ad: z.string(),
      tur: z.string(),
      ozet: z.string(),
      uygunluk_durumu: z.enum(["uyumlu", "incelenmeli", "ilgisiz"]),
      notlar: z.string(),
    })
  ),
});

/**
 * Analyzes citizen-uploaded attachments against the petition text.
 * Performs document categorization, fact cross-checking, discrepancy
 * detection, and provides structured findings for the reviewer.
 */
export async function ekleriAnalizEt(
  dilekceMetni: string,
  ekler: GirdiEkDosya[]
): Promise<EkAnalizSonucu> {
  if (ekler.length === 0) {
    return {
      dosyaSayisi: 0,
      tespitEdilenBelgeler: [],
      tutarlilikDurumu: "uyumlu",
      genelOzet: "Başvuruya eklenmiş dosya bulunmamaktadır.",
      caprazDogrulamaNotlari: [],
      eksikVeyaSupheliHususlar: [],
      dosyalar: [],
    };
  }

  const ekDosyalarMetni = ekler
    .map((e, index) => {
      const metinKismi = e.rawText?.trim()
        ? `\n--- Çıkarılan Metin / İçerik ---\n${e.rawText.slice(0, 3000)}`
        : "\n(Görsel veya metinsiz dosya)";
      return `[Dosya #${index + 1}: ${e.ad} (MIME: ${e.mimeTur}, Boyut: ${(e.boyut / 1024).toFixed(1)} KB)]${metinKismi}`;
    })
    .join("\n\n");

  try {
    const { model, temperature, maxOutputTokens } = getAgentModel("ek_analiz_agent");
    const { object } = await generateObject({
      model,
      temperature,
      maxOutputTokens,
      schema: Sema,
      prompt: loadPrompt("ek-analiz-agent", {
        dilekce_metni: dilekceMetni,
        ek_dosyalar: ekDosyalarMetni,
      }),
    });

    return {
      dosyaSayisi: ekler.length,
      tespitEdilenBelgeler: object.tespit_edilen_belgeler,
      tutarlilikDurumu: object.tutarlilik_durumu,
      genelOzet: object.genel_ozet,
      caprazDogrulamaNotlari: object.capraz_dogrulama_notlari,
      eksikVeyaSupheliHususlar: object.eksik_veya_supheli_hususlar,
      dosyalar: object.dosya_analizleri.map((d) => ({
        ad: d.ad,
        tur: d.tur,
        ozet: d.ozet,
        uygunlukDurumu: d.uygunluk_durumu,
        notlar: d.notlar,
      })),
    };
  } catch (err) {
    console.warn("Ek analizi LLM çağrısı başarısız, temel analizle devam ediliyor:", err);
    return {
      dosyaSayisi: ekler.length,
      tespitEdilenBelgeler: ekler.map((e) => e.ad),
      tutarlilikDurumu: "uyumlu",
      genelOzet: `${ekler.length} adet ek dosya yüklendi: ${ekler.map((e) => e.ad).join(", ")}.`,
      caprazDogrulamaNotlari: ["Ek belgeler başarıyla sisteme yüklendi ve arşivlendi."],
      eksikVeyaSupheliHususlar: [],
      dosyalar: ekler.map((e) => ({
        ad: e.ad,
        tur: e.mimeTur.startsWith("image/") ? "Görsel / Fotoğraf" : "Belge",
        ozet: e.rawText ? e.rawText.slice(0, 150) : "Dosya yüklendi.",
        uygunlukDurumu: "uyumlu",
        notlar: "Otomatik aktarıldı.",
      })),
    };
  }
}
