import { z } from "zod";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { getAgentModel } from "@/lib/ai/client";
import { loadPrompt } from "@/lib/ai/prompt";
import { db, schema } from "@/lib/db";
import { mevzuatAraVektor } from "@/lib/mevzuat";

export const maxDuration = 60;

function guvenliHataMesaji(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Asistan yanıtı oluşturulurken bir hata meydana geldi. Lütfen tekrar deneyin.";
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const { model, temperature, maxOutputTokens } = getAgentModel("vatandas_asistan_agent");
  const sistemTalimati = loadPrompt("vatandas-asistan-agent", {});

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        const modelMessages = await convertToModelMessages(messages);

        const result = streamText({
          model,
          temperature,
          maxOutputTokens,
          system: sistemTalimati,
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          tools: {
            kurumVeBirimleriListele: {
              description:
                "Sistemde kayıtlı kamu kurumlarını (belediyeler vb.) ve bunların bağlı müdürlüklerini/birimlerini listeler. Vatandaşın sorununun hangi kuruma/birime ait olduğunu doğru tespit etmek için çağır.",
              inputSchema: z.object({
                aramaTerimi: z.string().optional().describe("Opsiyonel arama terimi (örn. imar, fen, zabıta, yardım)."),
              }),
              execute: async ({ aramaTerimi }: { aramaTerimi?: string }) => {
                const kurumListesi = await db.select().from(schema.kurumlar);
                const birimListesi = await db.select().from(schema.birimler);

                const sonuclar = kurumListesi.map((k) => {
                  const bagliBirimler = birimListesi
                    .filter((b) => b.kurumId === k.id)
                    .filter((b) =>
                      aramaTerimi
                        ? b.ad.toLowerCase().includes(aramaTerimi.toLowerCase()) ||
                          (b.aciklama && b.aciklama.toLowerCase().includes(aramaTerimi.toLowerCase()))
                        : true
                    )
                    .map((b) => ({
                      birimAdi: b.ad,
                      kod: b.kod,
                      gorevAlani: b.aciklama || "Genel idari ve teknik hizmetler",
                    }));

                  return {
                    kurumAdi: k.ad,
                    aciklama: k.aciklama,
                    birimler: bagliBirimler,
                  };
                });

                return { kurumlar: sonuclar };
              },
            },

            mevzuatBilgisiSorgula: {
              description:
                "Vatandaşın talebine ilişkin yasal dayanakları ve kanun maddelerini tüm kurumların mevzuatı içinde arar (3071 sayılı Dilekçe Kanunu gibi genel kanunlar ile belediye, valilik, kaymakamlık ve bakanlık mevzuatı dahil).",
              inputSchema: z.object({
                sorgu: z.string().describe("Aranacak hukuki konu veya anahtar kelimeler (örn: dilekçe hakkı, kaldırım tamiri, ruhsatsız yapı)."),
              }),
              execute: async ({ sorgu }: { sorgu: string }) => {
                try {
                  // null = every institution's corpus. The previous
                  // "kurum-agnostik" was not a kurumId that exists, so the
                  // OR-filter it built matched nothing but the handful of
                  // articles published globally — the opposite of the
                  // institution-agnostic search the name promised.
                  const maddeler = await mevzuatAraVektor(null, sorgu, 4);
                  return {
                    sonuclar: maddeler.map((m) => ({
                      kodu: m.kodu,
                      baslik: m.baslik,
                      ozet: m.icerik,
                    })),
                  };
                } catch {
                  return {
                    sonuclar: [
                      {
                        kodu: "3071 Sayılı Kanun",
                        baslik: "Dilekçe Hakkının Kullanılmasına Dair Kanun",
                        ozet: "Türk vatandaşları kendileriyle veya kamu ile ilgili dilek ve şikayetleri hakkında yetkili makamlara başvurma hakkına sahiptir.",
                      },
                    ],
                  };
                }
              },
            },
          },
        });

        writer.merge(toUIMessageStream({ stream: result.stream, onError: guvenliHataMesaji }));
      },
    }),
  });
}
