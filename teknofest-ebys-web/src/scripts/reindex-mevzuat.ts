/**
 * Re-embeds the whole mevzuat corpus into Qdrant — run with
 * `npm run db:reindex-mevzuat` (add `-- --kuru` to inspect without writing).
 *
 * Two reasons this exists:
 *
 * 1. Seed articles were never searchable. seed.ts writes straight to
 *    Postgres with `db.insert(mevzuatMaddeleri)`, bypassing the indexing path
 *    in lib/mevzuat (`maddeleriKaydet`), so the hand-written articles that
 *    match the demo scenarios — 5393/15 yol, 2872/8 çöp, 5490/45 ikametgah,
 *    3071/3, 4982/11 — existed only as rows. Retrieval could not return them,
 *    which is why a bilgi-edinme request quoting 4982 came back with six
 *    teacher-overtime articles instead.
 *
 * 2. Changing the embedding model invalidates every stored vector. Vectors
 *    from different models are not comparable (see VEKTOR_BOYUTU's note in
 *    lib/vektor/qdrant.ts), so the corpus has to be re-embedded wholesale
 *    rather than topped up.
 *
 * Idempotent: a Qdrant point id is the article's Postgres id, so re-running
 * overwrites in place instead of duplicating. Seed rows carry short ids
 * ("m9") from before vector search existed and Qdrant only accepts UUIDs or
 * unsigned integers, so those rows are given a UUID first — nothing
 * references mevzuat_maddeleri.id by foreign key, and the only other use is
 * the /panel/mevzuat/<id> link, which follows the row.
 *
 * Mirrors src/lib/vektor/qdrant.ts rather than importing it: that module is
 * `import "server-only"`-gated and throws outside Next's bundler. Same
 * approach as src/scripts/ingest-ek-kurumlar.ts.
 */
import { randomUUID } from "node:crypto";
import { embedMany } from "ai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { eq } from "drizzle-orm";
import { db, schema } from "../lib/db";
import { getEmbeddingModel } from "../lib/ai/client";

const KURU = process.argv.includes("--kuru");
const YENIDEN_OLUSTUR = process.argv.includes("--yeniden-olustur");

const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const QDRANT_PREFIX = process.env.QDRANT_PREFIX;
const KOLEKSIYON = "mevzuat_maddeleri";
const GLOBAL_KURUM_SENTINEL = "global";
/** Keep in sync with VEKTOR_BOYUTU in lib/vektor/qdrant.ts. */
const VEKTOR_BOYUTU = 1024;
/** Same cap the ingestion script uses: an unbounded madde can blow the 8192-token context. */
const EMBED_METIN_SINIRI = 6000;
const YIGIN = 16;
/**
 * Milliseconds. The client's `timeout` is not seconds: at the 600 copied from
 * ingest-ek-kurumlar.ts every batch upsert aborted after 0.6s, while the small
 * getCollections calls still went through — so the run looked like a working
 * connection that could not write. A batch of 16×1024 floats to a remote
 * instance needs orders of magnitude more.
 */
const QDRANT_ZAMAN_ASIMI = 120_000;

const UUID_DESENI = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const qdrantUrl = new URL(QDRANT_URL);
const qdrant = new QdrantClient({
  url: QDRANT_URL,
  https: qdrantUrl.protocol === "https:",
  port: qdrantUrl.port ? Number(qdrantUrl.port) : qdrantUrl.protocol === "https:" ? 443 : 6333,
  apiKey: QDRANT_API_KEY,
  prefix: QDRANT_PREFIX,
  timeout: QDRANT_ZAMAN_ASIMI,
});

async function gomVektorler(metinler: string[]): Promise<number[][]> {
  if (metinler.length === 0) return [];
  const guvenli = metinler.map((m) =>
    m.length > EMBED_METIN_SINIRI ? m.slice(0, EMBED_METIN_SINIRI) : m
  );
  const { embeddings } = await embedMany({ model: getEmbeddingModel(), values: guvenli });
  return embeddings;
}

async function koleksiyonDurumu(): Promise<{ varMi: boolean; boyut?: number; nokta?: number }> {
  const mevcut = await qdrant.getCollections();
  if (!mevcut.collections.some((k) => k.name === KOLEKSIYON)) return { varMi: false };
  const bilgi = await qdrant.getCollection(KOLEKSIYON);
  const vektorler = bilgi.config?.params?.vectors;
  const boyut =
    typeof vektorler === "object" && vektorler !== null && "size" in vektorler
      ? Number(vektorler.size)
      : undefined;
  return { varMi: true, boyut, nokta: bilgi.points_count ?? 0 };
}

async function main() {
  console.log(`Mevzuat yeniden indeksleme${KURU ? " (KURU ÇALIŞMA — hiçbir şey yazılmaz)" : ""}`);
  console.log(`  Qdrant     : ${QDRANT_URL}${QDRANT_PREFIX ? ` (prefix: ${QDRANT_PREFIX})` : ""}`);
  console.log(`  Gömme mdl  : ${process.env.EMBEDDING_MODEL ?? "(varsayılan)"}`);

  const maddeler = await db
    .select({
      id: schema.mevzuatMaddeleri.id,
      kodu: schema.mevzuatMaddeleri.kodu,
      baslik: schema.mevzuatMaddeleri.baslik,
      icerik: schema.mevzuatMaddeleri.icerik,
      kurumId: schema.mevzuatMaddeleri.kurumId,
    })
    .from(schema.mevzuatMaddeleri);

  const kisaIdler = maddeler.filter((m) => !UUID_DESENI.test(m.id));
  const durum = await koleksiyonDurumu();

  console.log(`\n  Postgres   : ${maddeler.length} madde (${kisaIdler.length} tanesi UUID olmayan id)`);
  console.log(
    `  Qdrant     : ${durum.varMi ? `${durum.nokta} nokta, vektör boyutu ${durum.boyut}` : "koleksiyon yok"}`
  );

  // Probe the live embedding model before touching anything: a model whose
  // output size differs from the collection's makes every upsert fail, and
  // the collection has to be recreated rather than written into.
  const [probe] = await gomVektorler(["mevzuat indeksleme boyut kontrolü"]);
  console.log(`  Gömme boyutu: ${probe.length}`);

  if (durum.varMi && durum.boyut !== undefined && durum.boyut !== probe.length && !YENIDEN_OLUSTUR) {
    console.error(
      `\n  DURDU: koleksiyon ${durum.boyut} boyutlu, gömme modeli ${probe.length} üretiyor.\n` +
        `  Mevcut koleksiyonu silip yeniden oluşturmak gerekir:\n` +
        `    npm run db:reindex-mevzuat -- --yeniden-olustur\n` +
        `  (bu, koleksiyondaki tüm noktaları kalıcı olarak siler)`
    );
    process.exit(1);
  }

  if (KURU) {
    const kurumDagilimi = new Map<string, number>();
    for (const m of maddeler) {
      const anahtar = m.kurumId ?? GLOBAL_KURUM_SENTINEL;
      kurumDagilimi.set(anahtar, (kurumDagilimi.get(anahtar) ?? 0) + 1);
    }
    console.log("\n  Kuruma göre dağılım:");
    for (const [kurum, adet] of kurumDagilimi) console.log(`    ${kurum.padEnd(20)} ${adet}`);
    if (kisaIdler.length > 0) {
      console.log(`\n  UUID atanacak maddeler: ${kisaIdler.map((m) => `${m.id}(${m.kodu})`).join(", ")}`);
    }
    console.log("\n  Kuru çalışma bitti — yazma yapılmadı.");
    return;
  }

  if (YENIDEN_OLUSTUR && durum.varMi) {
    console.log(`\n  Koleksiyon siliniyor: ${KOLEKSIYON}`);
    await qdrant.deleteCollection(KOLEKSIYON);
  }

  const guncelDurum = await koleksiyonDurumu();
  if (!guncelDurum.varMi) {
    console.log(`  Koleksiyon oluşturuluyor (boyut ${probe.length})`);
    await qdrant.createCollection(KOLEKSIYON, {
      vectors: { size: probe.length || VEKTOR_BOYUTU, distance: "Cosine" },
    });
  }

  // Give the pre-vector-search seed rows a Qdrant-acceptable id before they
  // can be indexed under it.
  for (const madde of kisaIdler) {
    const yeniId = randomUUID();
    await db
      .update(schema.mevzuatMaddeleri)
      .set({ id: yeniId })
      .where(eq(schema.mevzuatMaddeleri.id, madde.id));
    console.log(`  id taşındı: ${madde.id} → ${yeniId} (${madde.kodu})`);
    madde.id = yeniId;
  }

  let yazilan = 0;
  for (let i = 0; i < maddeler.length; i += YIGIN) {
    const yigin = maddeler.slice(i, i + YIGIN);
    // Title and body together: a title alone is too short to embed well.
    const vektorler = await gomVektorler(yigin.map((m) => `${m.baslik}\n${m.icerik}`));
    await qdrant.upsert(KOLEKSIYON, {
      wait: true,
      points: yigin.map((m, j) => ({
        id: m.id,
        vector: vektorler[j],
        payload: {
          kurumId: m.kurumId ?? GLOBAL_KURUM_SENTINEL,
          kodu: m.kodu,
          baslik: m.baslik,
          icerik: m.icerik,
        },
      })),
    });
    yazilan += yigin.length;
    console.log(`  indekslendi: ${yazilan}/${maddeler.length}`);
  }

  const son = await koleksiyonDurumu();
  console.log(`\nBitti. Koleksiyonda ${son.nokta} nokta var.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Yeniden indeksleme başarısız:", err);
    process.exit(1);
  });
