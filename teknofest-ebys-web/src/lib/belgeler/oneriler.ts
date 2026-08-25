import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export type OneriHedefi = "belge" | "evrak";

export interface OneriKaydi {
  id: number;
  oncekiMetin: string;
  oneriMetin: string;
  gerekce: string;
  kaynak: string;
  durum: string;
  olusturanAdSoyad: string | null;
  olusturmaZamani: Date;
}

/**
 * Pending suggestions for a document, oldest first so review order is
 * stable. A suggestion always covers the whole document body — there is no
 * per-section addressing, since the document itself has no fixed sections.
 */
export async function bekleyenOnerileriGetir(
  hedefTuru: OneriHedefi,
  hedefId: string
): Promise<OneriKaydi[]> {
  const satirlar = await db
    .select({
      id: schema.belgeOnerileri.id,
      oncekiMetin: schema.belgeOnerileri.oncekiMetin,
      oneriMetin: schema.belgeOnerileri.oneriMetin,
      gerekce: schema.belgeOnerileri.gerekce,
      kaynak: schema.belgeOnerileri.kaynak,
      durum: schema.belgeOnerileri.durum,
      olusturanAdSoyad: schema.kullanicilar.adSoyad,
      olusturmaZamani: schema.belgeOnerileri.olusturmaZamani,
    })
    .from(schema.belgeOnerileri)
    .leftJoin(
      schema.kullanicilar,
      eq(schema.belgeOnerileri.olusturanKullaniciId, schema.kullanicilar.id)
    )
    .where(
      and(
        eq(schema.belgeOnerileri.hedefTuru, hedefTuru),
        eq(schema.belgeOnerileri.hedefId, hedefId),
        eq(schema.belgeOnerileri.durum, "bekliyor")
      )
    )
    .orderBy(schema.belgeOnerileri.id);

  return satirlar;
}

export async function oneriEkle(params: {
  hedefTuru: OneriHedefi;
  hedefId: string;
  oncekiMetin: string;
  oneriMetin: string;
  gerekce?: string;
  kaynak: "ai" | "kullanici";
  olusturanKullaniciId?: string;
}) {
  await db.insert(schema.belgeOnerileri).values({
    hedefTuru: params.hedefTuru,
    hedefId: params.hedefId,
    oncekiMetin: params.oncekiMetin,
    oneriMetin: params.oneriMetin,
    gerekce: params.gerekce ?? "",
    kaynak: params.kaynak,
    olusturanKullaniciId: params.olusturanKullaniciId ?? null,
  });
}

export async function oneriGetir(oneriId: number) {
  const [oneri] = await db
    .select()
    .from(schema.belgeOnerileri)
    .where(eq(schema.belgeOnerileri.id, oneriId));
  return oneri ?? null;
}

export async function oneriKararKaydet(
  oneriId: number,
  durum: "kabul" | "red",
  kullaniciId: string
) {
  await db
    .update(schema.belgeOnerileri)
    .set({ durum, kararVerenKullaniciId: kullaniciId, kararZamani: new Date() })
    .where(eq(schema.belgeOnerileri.id, oneriId));
}
