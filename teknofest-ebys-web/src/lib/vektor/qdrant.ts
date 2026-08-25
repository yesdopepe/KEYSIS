import "server-only";
import { embedMany } from "ai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbeddingModel } from "@/lib/ai/client";

/**
 * Vector search layer. SQLite stays the source of truth for text and
 * metadata; Qdrant only holds vectors plus enough payload to render a result
 * without a second round trip to the DB.
 *
 * Embeddings are produced by the EVREN inference service's `bge-m3-embed`
 * model (see lib/ai/client.ts) — text is sent off-machine for this, same as
 * every other LLM call in the app.
 *
 * Qdrant itself defaults to EVREN's shared, team-isolated instance too (see
 * QDRANT_URL/QDRANT_API_KEY/QDRANT_PREFIX in .env.example). A local Qdrant
 * (Docker or the Windows binary, see README) still works — point QDRANT_URL
 * at it and leave QDRANT_API_KEY/QDRANT_PREFIX unset.
 */

const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
/** Team path segment on EVREN's shared instance, e.g. "team07" — unused for local Qdrant. */
const QDRANT_PREFIX = process.env.QDRANT_PREFIX;

/**
 * Must match the embedding model's output size (EMBEDDING_MODEL in
 * .env.example — default `bge-m3-embed` is 1024). Changing either requires
 * recreating every Qdrant collection: koleksiyonlariHazirla only creates
 * missing collections, it never resizes an existing one, and vectors from
 * different embedding models are not comparable — all previously indexed
 * content must be re-embedded and re-upserted after a change.
 */
export const VEKTOR_BOYUTU = 1024;

export const KOLEKSIYONLAR = {
  kurumBelgeleri: "kurum_belge_parcalari",
  mevzuat: "mevzuat_maddeleri",
  sohbetEkleri: "sohbet_ekleri",
} as const;

export type KoleksiyonAdi = (typeof KOLEKSIYONLAR)[keyof typeof KOLEKSIYONLAR];

/**
 * Qdrant filters match on concrete values, so a mevzuat maddesi that applies
 * to every institution (SQL `kurum_id IS NULL`) is stored under this sentinel
 * instead. Every read and write of a nullable kurumId goes through here so
 * the two sides can never drift apart.
 */
export const GLOBAL_KURUM_SENTINEL = "global";

export function kurumIdPayload(kurumId: string | null): string {
  return kurumId ?? GLOBAL_KURUM_SENTINEL;
}

let istemci: QdrantClient | null = null;

function getIstemci(): QdrantClient {
  if (!istemci) {
    const url = new URL(QDRANT_URL);
    istemci = new QdrantClient({
      url: QDRANT_URL,
      https: url.protocol === "https:",
      // The client defaults to port 6333 and silently appends it even when
      // the URL implies a different one (e.g. 443 for https) — EVREN's docs
      // call this out explicitly as a source of confusing connection
      // failures, so it's always derived and passed rather than omitted.
      port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 6333,
      apiKey: QDRANT_API_KEY,
      prefix: QDRANT_PREFIX,
      // EVREN's instance is shared infra, not the near-instant local
      // binary this used to always be — generous ceiling, not a slowdown.
      timeout: 600,
    });
  }
  return istemci;
}

let hazirlandi = false;

/**
 * Creates the collections if they don't exist. Lazily invoked by every read
 * and write rather than at startup — Next.js has no clean app-boot hook, and
 * the check is a single cheap call once per process.
 */
export async function koleksiyonlariHazirla(): Promise<void> {
  if (hazirlandi) return;

  const istemci = getIstemci();
  const mevcut = await istemci.getCollections();
  const adlar = new Set(mevcut.collections.map((k) => k.name));

  for (const ad of Object.values(KOLEKSIYONLAR)) {
    if (adlar.has(ad)) continue;
    await istemci.createCollection(ad, {
      vectors: { size: VEKTOR_BOYUTU, distance: "Cosine" },
    });
  }

  hazirlandi = true;
}

async function gomVektorleriAl(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Unlike the e5 model this replaced, bge-m3 is trained symmetrically and
  // needs no "query: "/"passage: " prefixing for asymmetric retrieval.
  const { embeddings } = await embedMany({
    model: getEmbeddingModel(),
    values: texts,
  });
  return embeddings;
}

/** Embeds a search query. */
export async function sorguGomVektoru(metin: string): Promise<number[]> {
  const [vektor] = await gomVektorleriAl([metin]);
  if (!vektor) throw new Error("Sorgu için gömme vektörü üretilemedi.");
  return vektor;
}

/** Embeds passages to be stored, in one batch call. */
export async function pasajGomVektorleri(metinler: string[]): Promise<number[][]> {
  return gomVektorleriAl(metinler);
}

export interface VektorNoktasi {
  id: string | number;
  vector: number[];
  payload: Record<string, unknown>;
}

export async function noktalariEkle(
  koleksiyon: KoleksiyonAdi,
  noktalar: VektorNoktasi[]
): Promise<void> {
  if (noktalar.length === 0) return;
  await koleksiyonlariHazirla();
  await getIstemci().upsert(koleksiyon, { wait: true, points: noktalar });
}

export async function noktalariSil(
  koleksiyon: KoleksiyonAdi,
  idler: (string | number)[]
): Promise<void> {
  if (idler.length === 0) return;
  await koleksiyonlariHazirla();
  await getIstemci().delete(koleksiyon, { wait: true, points: idler });
}

/** Deletes every point whose payload matches, e.g. all chunks of one document. */
export async function noktalariFiltreyleSil(
  koleksiyon: KoleksiyonAdi,
  filtre: Record<string, string | number>
): Promise<void> {
  await koleksiyonlariHazirla();
  await getIstemci().delete(koleksiyon, {
    wait: true,
    filter: {
      must: Object.entries(filtre).map(([key, value]) => ({ key, match: { value } })),
    },
  });
}

export interface AramaSonucu {
  id: string | number;
  skor: number;
  payload: Record<string, unknown>;
}

/**
 * `must` clauses are ANDed (tenant scoping), `should` clauses are ORed (e.g.
 * "this institution's mevzuat OR the global corpus"). Callers must always
 * pass the tenant filter in `must` — a search with no tenant scoping would
 * read across institutions.
 */
export async function ara(
  koleksiyon: KoleksiyonAdi,
  vektor: number[],
  filtre: {
    must?: Record<string, string | number>;
    should?: { key: string; value: string | number }[];
  },
  topK: number
): Promise<AramaSonucu[]> {
  await koleksiyonlariHazirla();

  const qdrantFiltresi: Record<string, unknown> = {};
  if (filtre.must) {
    qdrantFiltresi.must = Object.entries(filtre.must).map(([key, value]) => ({
      key,
      match: { value },
    }));
  }
  if (filtre.should) {
    qdrantFiltresi.should = filtre.should.map(({ key, value }) => ({
      key,
      match: { value },
    }));
  }

  const sonuc = await getIstemci().query(koleksiyon, {
    query: vektor,
    limit: topK,
    with_payload: true,
    filter: Object.keys(qdrantFiltresi).length > 0 ? qdrantFiltresi : undefined,
  });

  return sonuc.points.map((s) => ({
    id: s.id,
    skor: s.score,
    payload: (s.payload ?? {}) as Record<string, unknown>,
  }));
}
