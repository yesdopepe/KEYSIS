import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  KOLEKSIYONLAR,
  ara,
  noktalariEkle,
  noktalariFiltreyleSil,
  pasajGomVektorleri,
  sorguGomVektoru,
} from "@/lib/vektor/qdrant";

/**
 * Institution knowledge base: documents an admin uploads ahead of time,
 * chunked for retrieval. The assistant answers from these, so every chunk
 * carries enough identity (source document name + position) to be cited —
 * an answer the reader cannot trace back to a document is not useful in a
 * public-sector context.
 */

const PARCA_UZUNLUGU = 900;
const PARCA_ORTUSME = 150;

/**
 * Splits on paragraph boundaries and packs them up to the size limit, so a
 * chunk rarely cuts a sentence in half. Overlap carries the tail of the
 * previous chunk forward so a fact spanning a boundary is still findable.
 */
export function metniParcala(metin: string): string[] {
  const paragraflar = metin
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const parcalar: string[] = [];
  let mevcut = "";

  for (const p of paragraflar) {
    if (mevcut.length + p.length + 2 <= PARCA_UZUNLUGU) {
      mevcut = mevcut ? `${mevcut}\n\n${p}` : p;
      continue;
    }
    if (mevcut) parcalar.push(mevcut);

    if (p.length <= PARCA_UZUNLUGU) {
      mevcut = p;
      continue;
    }
    // A single oversized paragraph still has to be broken up.
    for (let i = 0; i < p.length; i += PARCA_UZUNLUGU - PARCA_ORTUSME) {
      parcalar.push(p.slice(i, i + PARCA_UZUNLUGU));
    }
    mevcut = "";
  }
  if (mevcut) parcalar.push(mevcut);

  return parcalar.length > 0 ? parcalar : [metin.trim()].filter(Boolean);
}

export async function kurumBelgesiEkle(params: {
  kurumId: string;
  ad: string;
  dosyaAdi?: string;
  rawText: string;
  yukleyenKullaniciId: string;
}): Promise<{ id: string; parcaSayisi: number }> {
  const id = randomUUID();
  await db.insert(schema.kurumBelgeleri).values({
    id,
    kurumId: params.kurumId,
    ad: params.ad,
    dosyaAdi: params.dosyaAdi ?? null,
    rawText: params.rawText,
    yukleyenKullaniciId: params.yukleyenKullaniciId,
  });

  const parcalar = metniParcala(params.rawText);
  if (parcalar.length > 0) {
    const satirlar = await db
      .insert(schema.kurumBelgeParcalari)
      .values(
        parcalar.map((metin, sira) => ({
          kurumBelgesiId: id,
          kurumId: params.kurumId,
          sira,
          metin,
        }))
      )
      .returning({ id: schema.kurumBelgeParcalari.id, sira: schema.kurumBelgeParcalari.sira });

    const vektorler = await pasajGomVektorleri(parcalar);

    await noktalariEkle(
      KOLEKSIYONLAR.kurumBelgeleri,
      satirlar.map((satir) => ({
        id: satir.id,
        vector: vektorler[satir.sira],
        payload: {
          kurumId: params.kurumId,
          kurumBelgesiId: id,
          belgeAdi: params.ad,
          sira: satir.sira,
          metin: parcalar[satir.sira],
        },
      }))
    );
  }

  return { id, parcaSayisi: parcalar.length };
}

export interface BilgiTabaniSonucu {
  belgeAdi: string;
  parcaNo: number;
  metin: string;
  /** In-app link to the source document, so a citation can be followed. */
  link: string;
  skor: number;
}

/**
 * Vector retrieval scoped to one institution. kurumId comes from the
 * caller's session, never from a model-supplied argument — a tool call must
 * not be able to reach another institution's documents.
 */
export async function bilgiTabanindaAra(
  kurumId: string,
  sorgu: string,
  topK = 4
): Promise<BilgiTabaniSonucu[]> {
  const vektor = await sorguGomVektoru(sorgu);
  const sonuclar = await ara(
    KOLEKSIYONLAR.kurumBelgeleri,
    vektor,
    { must: { kurumId } },
    topK
  );

  return sonuclar.map((s) => ({
    belgeAdi: String(s.payload.belgeAdi ?? ""),
    parcaNo: Number(s.payload.sira ?? 0) + 1,
    metin: String(s.payload.metin ?? ""),
    link: `/panel/kurum-belgeleri/${s.payload.kurumBelgesiId}`,
    skor: Number(s.skor.toFixed(3)),
  }));
}

export async function kurumBelgeleriniListele(kurumId: string) {
  return db
    .select({
      id: schema.kurumBelgeleri.id,
      ad: schema.kurumBelgeleri.ad,
      dosyaAdi: schema.kurumBelgeleri.dosyaAdi,
      olusturmaZamani: schema.kurumBelgeleri.olusturmaZamani,
      yukleyen: schema.kullanicilar.adSoyad,
    })
    .from(schema.kurumBelgeleri)
    .leftJoin(
      schema.kullanicilar,
      eq(schema.kurumBelgeleri.yukleyenKullaniciId, schema.kullanicilar.id)
    )
    .where(eq(schema.kurumBelgeleri.kurumId, kurumId))
    .orderBy(schema.kurumBelgeleri.olusturmaZamani);
}

/** One document plus its chunks, for the detail page a citation links to. */
export async function kurumBelgesiGetir(kurumId: string, belgeId: string) {
  const [belge] = await db
    .select()
    .from(schema.kurumBelgeleri)
    .where(and(eq(schema.kurumBelgeleri.id, belgeId), eq(schema.kurumBelgeleri.kurumId, kurumId)));
  if (!belge) return null;

  const parcalar = await db
    .select({
      sira: schema.kurumBelgeParcalari.sira,
      metin: schema.kurumBelgeParcalari.metin,
    })
    .from(schema.kurumBelgeParcalari)
    .where(eq(schema.kurumBelgeParcalari.kurumBelgesiId, belgeId))
    .orderBy(schema.kurumBelgeParcalari.sira);

  return { belge, parcalar };
}

export async function kurumBelgesiSil(kurumId: string, belgeId: string) {
  // Vectors go too, or the assistant would keep citing a deleted document.
  await noktalariFiltreyleSil(KOLEKSIYONLAR.kurumBelgeleri, {
    kurumId,
    kurumBelgesiId: belgeId,
  });

  // Chunks first — they hold the foreign key.
  await db
    .delete(schema.kurumBelgeParcalari)
    .where(
      and(
        eq(schema.kurumBelgeParcalari.kurumBelgesiId, belgeId),
        eq(schema.kurumBelgeParcalari.kurumId, kurumId)
      )
    );
  await db
    .delete(schema.kurumBelgeleri)
    .where(and(eq(schema.kurumBelgeleri.id, belgeId), eq(schema.kurumBelgeleri.kurumId, kurumId)));
}
