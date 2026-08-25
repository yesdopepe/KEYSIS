import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { evraktanModel } from "@/lib/belgeler/modelle";
import { belgeDosyaYaniti } from "@/lib/belgeler/disa-aktar";
import { formatCoz } from "@/lib/belgeler/formatlar";

/**
 * Public download for the citizen, keyed only by takip no — deliberately
 * unauthenticated, matching how the tracking page works. The gate is the
 * same one basvuruDurumSorgula applies: nothing is downloadable until the
 * response has actually been sent.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ takipNo: string }> }
) {
  const format = formatCoz(new URL(request.url).searchParams.get("format"));
  if (!format) return new Response("Geçersiz format.", { status: 400 });

  const { takipNo } = await params;
  const [evrak] = await db
    .select()
    .from(schema.evraklar)
    .where(eq(schema.evraklar.takipNo, decodeURIComponent(takipNo).trim().toUpperCase()));

  if (!evrak) return new Response("Başvuru bulunamadı.", { status: 404 });
  if (evrak.durum !== "gonderildi") {
    return new Response("Başvurunuza ilişkin yazı henüz gönderilmemiştir.", { status: 403 });
  }

  const [kurum] = evrak.kurumId
    ? await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, evrak.kurumId))
    : [];
  const [birim] = evrak.birimId
    ? await db.select().from(schema.birimler).where(eq(schema.birimler.id, evrak.birimId))
    : [];

  const model = evraktanModel(evrak, kurum?.ad ?? "Kurum", birim?.ad);
  if (!model) return new Response("Yazı bulunamadı.", { status: 404 });

  return belgeDosyaYaniti(model, format, `Basvuru-Yaniti-${evrak.takipNo}`);
}
