import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { belgedenModel } from "@/lib/belgeler/modelle";
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
  const [belge] = await db.select().from(schema.belgeler).where(eq(schema.belgeler.id, id));
  if (!belge) return new Response("Belge bulunamadı.", { status: 404 });
  // Scoped to the reader's own institution, same rule the detail page uses.
  if (belge.kurumId !== session.kurumId) return new Response("Yetkisiz.", { status: 403 });

  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, belge.kurumId));
  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, belge.birimId));
  const [yazar] = await db
    .select()
    .from(schema.kullanicilar)
    .where(eq(schema.kullanicilar.id, belge.olusturanKullaniciId));

  const model = belgedenModel(belge, kurum?.ad ?? "Kurum", birim?.ad, {
    adSoyad: yazar?.adSoyad ?? "",
    unvan: yazar?.unvan ?? "",
  });

  return belgeDosyaYaniti(model, format, `${model.belgeTuruAdi}-${belge.baslik}`);
}
