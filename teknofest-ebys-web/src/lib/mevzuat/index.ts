import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  GLOBAL_KURUM_SENTINEL,
  KOLEKSIYONLAR,
  ara,
  kurumIdPayload,
  noktalariEkle,
  noktalariSil,
  pasajGomVektorleri,
  sorguGomVektoru,
} from "@/lib/vektor/qdrant";
import { mevzuatMetniParcala, type AyrilmisMadde } from "./parcala";

/**
 * The mevzuat corpus: legislation split into individual articles. Unlike the
 * institution knowledge base — which is chunked purely for retrieval — an
 * article is the unit a document actually cites ("5393/15"), so the split has
 * to follow the law's own structure rather than a character budget.
 *
 * This module is the single retrieval path for every consumer (the chat
 * assistant, the reader agent, the document writer), so all three ground
 * their citations in exactly the same results.
 */

export { mevzuatMetniParcala, type AyrilmisMadde } from "./parcala";

async function maddeleriKaydet(
  maddeler: AyrilmisMadde[],
  kurumId: string | null
): Promise<string[]> {
  if (maddeler.length === 0) return [];

  const idler = maddeler.map(() => randomUUID());

  await db.insert(schema.mevzuatMaddeleri).values(
    maddeler.map((m, i) => ({
      id: idler[i],
      kodu: m.kodu,
      baslik: m.baslik,
      icerik: m.icerik,
      kurumId,
    }))
  );

  // Indexing failure must not leave the rows behind. Postgres has to be
  // written first — the Qdrant point id *is* the row id — so the rows are
  // rolled back by hand if embedding or indexing throws. Without this an
  // upload that failed half way through still listed its articles in the UI
  // while being permanently unsearchable, which is the state the pre-vector
  // seed corpus was in and how ingest-ek-kurumlar.ts silently lost 45.
  try {
    // The article body carries the meaning; the title alone is too short to
    // embed well, so both go in.
    const vektorler = await pasajGomVektorleri(
      maddeler.map((m) => `${m.baslik}\n${m.icerik}`)
    );

    await noktalariEkle(
      KOLEKSIYONLAR.mevzuat,
      maddeler.map((m, i) => ({
        id: idler[i],
        vector: vektorler[i],
        payload: {
          kurumId: kurumIdPayload(kurumId),
          kodu: m.kodu,
          baslik: m.baslik,
          icerik: m.icerik,
        },
      }))
    );
  } catch (err) {
    await db.delete(schema.mevzuatMaddeleri).where(inArray(schema.mevzuatMaddeleri.id, idler));
    throw new Error(
      `Mevzuat indekslenemedi, hiçbir madde kaydedilmedi: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err }
    );
  }

  return idler;
}

export async function mevzuatBelgesiEkle(params: {
  kanunKodu: string;
  kanunAdi: string;
  kurumId: string | null;
  rawText: string;
}): Promise<{ maddeSayisi: number }> {
  const maddeler = mevzuatMetniParcala(
    params.rawText,
    params.kanunKodu,
    params.kanunAdi
  );
  await maddeleriKaydet(maddeler, params.kurumId);
  return { maddeSayisi: maddeler.length };
}

/** Manual single-article entry, for correcting a bad split. */
export async function mevzuatMaddesiEkle(params: {
  kodu: string;
  baslik: string;
  icerik: string;
  kurumId: string | null;
}): Promise<string> {
  const [id] = await maddeleriKaydet(
    [{ kodu: params.kodu, baslik: params.baslik, icerik: params.icerik }],
    params.kurumId
  );
  return id;
}

export interface MevzuatSonucu {
  maddeId: string;
  kodu: string;
  baslik: string;
  icerik: string;
  /** In-app link to the full article, so a citation can be followed. */
  link: string;
  skor: number;
}

/**
 * Vector search over the corpus visible to one institution: its own articles
 * plus the global ones. kurumId must come from the session, never from a
 * model-supplied tool argument.
 */
export async function mevzuatAraVektor(
  kurumId: string,
  sorgu: string,
  topK = 5
): Promise<MevzuatSonucu[]> {
  const vektor = await sorguGomVektoru(sorgu);
  const sonuclar = await ara(
    KOLEKSIYONLAR.mevzuat,
    vektor,
    {
      should: [
        { key: "kurumId", value: kurumId },
        { key: "kurumId", value: GLOBAL_KURUM_SENTINEL },
      ],
    },
    topK
  );

  return sonuclar.map((s) => ({
    maddeId: String(s.id),
    kodu: String(s.payload.kodu ?? ""),
    baslik: String(s.payload.baslik ?? ""),
    icerik: String(s.payload.icerik ?? ""),
    link: `/panel/mevzuat/${s.id}`,
    skor: Number(s.skor.toFixed(3)),
  }));
}

export async function mevzuatMaddeleriniListele(kurumId: string) {
  return db
    .select({
      id: schema.mevzuatMaddeleri.id,
      kodu: schema.mevzuatMaddeleri.kodu,
      baslik: schema.mevzuatMaddeleri.baslik,
      kurumId: schema.mevzuatMaddeleri.kurumId,
      createdAt: schema.mevzuatMaddeleri.createdAt,
    })
    .from(schema.mevzuatMaddeleri)
    .where(
      or(
        eq(schema.mevzuatMaddeleri.kurumId, kurumId),
        isNull(schema.mevzuatMaddeleri.kurumId)
      )
    )
    .orderBy(schema.mevzuatMaddeleri.kodu);
}

/** Single article for the detail page, scoped to what this institution may read. */
export async function mevzuatMaddesiGetir(kurumId: string, maddeId: string) {
  const [madde] = await db
    .select()
    .from(schema.mevzuatMaddeleri)
    .where(
      and(
        eq(schema.mevzuatMaddeleri.id, maddeId),
        or(
          eq(schema.mevzuatMaddeleri.kurumId, kurumId),
          isNull(schema.mevzuatMaddeleri.kurumId)
        )
      )
    );
  return madde ?? null;
}

const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function mevzuatMaddesiSil(kurumId: string, maddeId: string): Promise<void> {
  // Scoped delete: an institution may remove its own article or a global one
  // it curates, but never another institution's.
  await db
    .delete(schema.mevzuatMaddeleri)
    .where(
      and(
        eq(schema.mevzuatMaddeleri.id, maddeId),
        or(
          eq(schema.mevzuatMaddeleri.kurumId, kurumId),
          isNull(schema.mevzuatMaddeleri.kurumId)
        )
      )
    );

  // Seed rows use short ids ("m9") from before vector search existed. They
  // have no Qdrant point, and Qdrant rejects a non-UUID id outright — so
  // asking it to delete one would fail the whole action.
  if (UUID_DESENI.test(maddeId)) {
    await noktalariSil(KOLEKSIYONLAR.mevzuat, [maddeId]);
  }
}
