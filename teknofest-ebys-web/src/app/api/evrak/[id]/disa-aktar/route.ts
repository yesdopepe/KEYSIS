import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { evraktanModel } from "@/lib/belgeler/modelle";
import { belgeDosyaYaniti } from "@/lib/belgeler/disa-aktar";
import { formatCoz } from "@/lib/belgeler/formatlar";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return new Response("Yetkisiz.", { status: 401 });

  const format = formatCoz(new URL(request.url).searchParams.get("format"));
  if (!format) return new Response("Geçersiz format.", { status: 400 });

  const { id } = await params;
  const [evrak] = await db.select().from(schema.evraklar).where(eq(schema.evraklar.id, id));
  if (!evrak) return new Response("Evrak bulunamadı.", { status: 404 });
  if (evrak.kurumId !== session.kurumId) return new Response("Yetkisiz.", { status: 403 });

  const [kurum] = evrak.kurumId
    ? await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, evrak.kurumId))
    : [];
  const [birim] = evrak.birimId
    ? await db.select().from(schema.birimler).where(eq(schema.birimler.id, evrak.birimId))
    : [];

  const model = evraktanModel(evrak, kurum?.ad ?? "Kurum", birim?.ad, {
    adSoyad: session.adSoyad,
    unvan: session.unvan,
  });
  if (!model) return new Response("Bu evrakın hazırlanmış bir yazısı yok.", { status: 404 });

  return belgeDosyaYaniti(model, format, `Yazi-${evrak.takipNo}`);
}
