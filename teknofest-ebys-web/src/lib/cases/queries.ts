import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function birimEvraklariGetir(birimId: string, durumlar?: string[]) {
  const kosullar = [eq(schema.evraklar.birimId, birimId)];
  const rows = await db
    .select()
    .from(schema.evraklar)
    .where(and(...kosullar))
    .orderBy(asc(schema.evraklar.olusturmaZamani));

  if (!durumlar) return rows;
  return rows.filter((r) => durumlar.includes(r.durum));
}

/**
 * Cases in a birim whose response is in the multi-level approval chain,
 * annotated with whether it's this user's turn (their hierarchy level
 * matches the next unresolved step, in sıra order).
 */
export async function onayimBekleyenEvraklarGetir(birimId: string, hiyerarsiSeviyesi: number) {
  const evraklar = await birimEvraklariGetir(birimId, ["onay_zincirinde"]);
  if (evraklar.length === 0) return [];

  const adimlar = await db
    .select()
    .from(schema.onayAdimlari)
    .where(
      and(
        eq(schema.onayAdimlari.hedefTuru, "evrak"),
        inArray(schema.onayAdimlari.hedefId, evraklar.map((e) => e.id))
      )
    )
    .orderBy(asc(schema.onayAdimlari.sira));

  const sonuc: Array<{ evrak: (typeof evraklar)[number]; benimSiram: boolean; adimlar: typeof adimlar }> = [];

  for (const evrak of evraklar) {
    const evrakAdimlari = adimlar.filter((a) => a.hedefId === evrak.id);
    const siradakiAdim = evrakAdimlari.find((a) => a.durum === "bekliyor");
    sonuc.push({
      evrak,
      benimSiram: siradakiAdim?.gerekliHiyerarsiSeviyesi === hiyerarsiSeviyesi,
      adimlar: evrakAdimlari,
    });
  }

  return sonuc;
}

export async function evrakDetayGetir(evrakId: string) {
  const [evrak] = await db.select().from(schema.evraklar).where(eq(schema.evraklar.id, evrakId));
  if (!evrak) return null;

  const [kurum] = evrak.kurumId
    ? await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, evrak.kurumId))
    : [null];
  const [birim] = evrak.birimId
    ? await db.select().from(schema.birimler).where(eq(schema.birimler.id, evrak.birimId))
    : [null];
  const sablon = evrak.evrakTuru
    ? await db.select().from(schema.yazismaSablonlari).where(eq(schema.yazismaSablonlari.evrakTuru, evrak.evrakTuru))
    : [];
  const onayAdimlari = await db
    .select()
    .from(schema.onayAdimlari)
    .where(and(eq(schema.onayAdimlari.hedefTuru, "evrak"), eq(schema.onayAdimlari.hedefId, evrakId)))
    .orderBy(asc(schema.onayAdimlari.sira));
  const havaleler = await db
    .select()
    .from(schema.havaleler)
    .where(and(eq(schema.havaleler.hedefTuru, "evrak"), eq(schema.havaleler.hedefId, evrakId)))
    .orderBy(asc(schema.havaleler.zaman));
  const auditKayitlari = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.evrakId, evrakId))
    .orderBy(asc(schema.auditLog.zaman));

  return { evrak, kurum, birim, sablon: sablon[0] ?? null, onayAdimlari, havaleler, auditKayitlari };
}

export async function tumKurumVeBirimler() {
  const kurumlar = await db.select().from(schema.kurumlar);
  const birimler = await db.select().from(schema.birimler);
  return { kurumlar, birimler };
}
