/**
 * One-off ingestion script — run with `npm run db:ingest-kurumlar`.
 *
 * Creates two additional kurumlar (Millî Eğitim Bakanlığı, Elazığ Valiliği)
 * with demo staff accounts, then bulk-ingests every PDF under
 * data/MEB_Mevzuatlari (2)/MEB_Mevzuatlari and data/elazigvaliligi into
 * whichever corpus fits each document: the mevzuat pipeline (kanun/yönetmelik
 * split into citable "madde" articles) when a document actually has "MADDE
 * n" structure, otherwise the kurum bilgi tabanı pipeline (generic
 * paragraph-chunked retrieval) — decided per document from its own parsed
 * content, not guessed from filename or folder.
 *
 * Not wired into src/app/yonetim or the /panel upload actions: those need a
 * logged-in session (oturumIzinliKil) and go through Next's server-action
 * plumbing. This script talks to the db/embedding/vector-store/docling
 * layers directly, the same way seed.ts does for the base demo data — see
 * the "mirrors ..." comments below for exactly which app module each block
 * stands in for (re-imported where safe, hand-copied where the source file
 * is `import "server-only"`-gated and would throw outside Next's bundler).
 *
 * Safe to re-run: kurum/birim/kullanıcı inserts no-op on conflict, and each
 * document is skipped if a row for it already exists.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { embedMany } from "ai";
import { Agent } from "undici";
import { QdrantClient } from "@qdrant/js-client-rest";
import { eq, and, like, or } from "drizzle-orm";
import { db, schema } from "../lib/db";
import { getEmbeddingModel } from "../lib/ai/client";
import { mevzuatMetniParcala } from "../lib/mevzuat/parcala";

const DEMO_SIFRE = "ebys123";
const DEMO_SIFRE_HASH = bcrypt.hashSync(DEMO_SIFRE, 10);

const DATA_DIR = path.resolve(__dirname, "../../data");
const MEB_DIR = path.join(DATA_DIR, "MEB_Mevzuatlari (2)", "MEB_Mevzuatlari");
const VALILIK_DIR = path.join(DATA_DIR, "elazigvaliligi");

// ---------------------------------------------------------------------------
// Qdrant (mirrors src/lib/vektor/qdrant.ts — that module is `server-only`,
// which unconditionally throws outside Next's bundler, see node_modules/
// server-only/index.js, so its connection setup + upsert calls are
// reproduced here rather than imported).
// ---------------------------------------------------------------------------
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const QDRANT_PREFIX = process.env.QDRANT_PREFIX;
const VEKTOR_BOYUTU = 1024;
const KOLEKSIYONLAR = {
  kurumBelgeleri: "kurum_belge_parcalari",
  mevzuat: "mevzuat_maddeleri",
} as const;

const qdrantUrl = new URL(QDRANT_URL);
const qdrant = new QdrantClient({
  url: QDRANT_URL,
  https: qdrantUrl.protocol === "https:",
  port: qdrantUrl.port ? Number(qdrantUrl.port) : qdrantUrl.protocol === "https:" ? 443 : 6333,
  apiKey: QDRANT_API_KEY,
  prefix: QDRANT_PREFIX,
  // Milliseconds (see the note in src/lib/vektor/qdrant.ts) — at 600 this
  // aborted after 0.6s, which is why 45 of the articles this script inserted
  // into Postgres never reached the index.
  timeout: 120_000,
});

let koleksiyonlarHazir = false;
async function koleksiyonlariHazirla(): Promise<void> {
  if (koleksiyonlarHazir) return;
  const mevcut = await qdrant.getCollections();
  const adlar = new Set(mevcut.collections.map((k) => k.name));
  for (const ad of Object.values(KOLEKSIYONLAR)) {
    if (adlar.has(ad)) continue;
    await qdrant.createCollection(ad, { vectors: { size: VEKTOR_BOYUTU, distance: "Cosine" } });
  }
  koleksiyonlarHazir = true;
}

// Embedding-input safety cap. A generic chunk (metniParcala, ≤900 chars) is
// always well under this; a mevzuat "madde" is unbounded — if OCR on a large
// scan misses a MADDE header, two articles merge into one and can exceed the
// embedding model's 8192-token context (hit once, on a 22MB scanned yönerge:
// litellm.ContextWindowExceededError). ~4 chars/token for Turkish leaves
// plenty of headroom under 8192. Only the embedding input is capped — the
// full text is still stored as-is in Postgres for display/citation.
const EMBED_METIN_SINIRI = 6000;

async function pasajGomVektorleri(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const guvenli = texts.map((t) => (t.length > EMBED_METIN_SINIRI ? t.slice(0, EMBED_METIN_SINIRI) : t));
  const { embeddings } = await embedMany({ model: getEmbeddingModel(), values: guvenli });
  return embeddings;
}

// ---------------------------------------------------------------------------
// Docling client (mirrors src/lib/docling/index.ts — same server-only issue).
// ---------------------------------------------------------------------------
const DOCLING_URL = (process.env.DOCLING_SERVICE_URL ?? "http://localhost:8100").replace(/\/+$/, "");
const DOCLING_SHARED_SECRET = process.env.DOCLING_SHARED_SECRET;
// Some of these PDFs are large scans (the Valilik yönerge set runs 3-23MB) —
// OCR on those can genuinely take a long time, same rationale as the
// original client's dispatcher. Bumped from 20 to 45 minutes after the two
// largest files (18.7MB, 23.1MB) aborted twice in a row at 20 — this rules
// out the dispatcher as the cause if they still abort at the same elapsed
// time (pointing instead at the ngrok tunnel's own limit).
const UZUN_ISLEM_DISPATCHER = new Agent({ headersTimeout: 45 * 60 * 1000, bodyTimeout: 45 * 60 * 1000 });

async function dosyadanMetinCikar(dosyaYolu: string): Promise<string> {
  const buf = readFileSync(dosyaYolu);
  const dosyaAdi = path.basename(dosyaYolu);
  const dosya = new File([new Uint8Array(buf)], dosyaAdi, { type: "application/pdf" });
  const formData = new FormData();
  formData.append("file", dosya, dosyaAdi);

  const res = await fetch(`${DOCLING_URL}/convert`, {
    method: "POST",
    body: formData,
    headers: DOCLING_SHARED_SECRET ? { Authorization: `Bearer ${DOCLING_SHARED_SECRET}` } : undefined,
    dispatcher: UZUN_ISLEM_DISPATCHER,
  } as RequestInit);
  if (!res.ok) {
    throw new Error(`Docling ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  const data = (await res.json()) as { raw_text: string };
  return data.raw_text;
}

// ---------------------------------------------------------------------------
// Kurum bilgi tabanı chunking + insert (mirrors src/lib/bilgi-tabani/index.ts).
// ---------------------------------------------------------------------------
const PARCA_UZUNLUGU = 900;
const PARCA_ORTUSME = 150;

function metniParcala(metin: string): string[] {
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
    for (let i = 0; i < p.length; i += PARCA_UZUNLUGU - PARCA_ORTUSME) {
      parcalar.push(p.slice(i, i + PARCA_UZUNLUGU));
    }
    mevcut = "";
  }
  if (mevcut) parcalar.push(mevcut);

  return parcalar.length > 0 ? parcalar : [metin.trim()].filter(Boolean);
}

async function kurumBelgesiEkle(params: {
  kurumId: string;
  ad: string;
  dosyaAdi: string;
  rawText: string;
  yukleyenKullaniciId: string;
}): Promise<{ parcaSayisi: number }> {
  const parcalar = metniParcala(params.rawText);

  // Embedded before anything is written — kurum_belge_parcalari.id is a
  // db-generated serial, so the embed step can't run first the way
  // mevzuatBelgesiEkle does with its client-generated UUIDs; instead, a
  // failure here throws before any row exists, so there's nothing to clean
  // up (a prior run without this guard did leave orphaned rows once — a
  // document row with no chunks/vectors, indistinguishable from "done" to
  // the idempotency check — see the manual cleanup this script's git log
  // notes; this ordering is what prevents a repeat).
  const vektorler = parcalar.length > 0 ? await pasajGomVektorleri(parcalar) : [];

  const id = randomUUID();
  await db.insert(schema.kurumBelgeleri).values({
    id,
    kurumId: params.kurumId,
    ad: params.ad,
    dosyaAdi: params.dosyaAdi,
    rawText: params.rawText,
    yukleyenKullaniciId: params.yukleyenKullaniciId,
  });

  if (parcalar.length === 0) return { parcaSayisi: 0 };

  try {
    const satirlar = await db
      .insert(schema.kurumBelgeParcalari)
      .values(parcalar.map((metin, sira) => ({ kurumBelgesiId: id, kurumId: params.kurumId, sira, metin })))
      .returning({ id: schema.kurumBelgeParcalari.id, sira: schema.kurumBelgeParcalari.sira });

    await koleksiyonlariHazirla();
    await qdrant.upsert(KOLEKSIYONLAR.kurumBelgeleri, {
      wait: true,
      points: satirlar.map((satir) => ({
        id: satir.id,
        vector: vektorler[satir.sira],
        payload: {
          kurumId: params.kurumId,
          kurumBelgesiId: id,
          belgeAdi: params.ad,
          sira: satir.sira,
          metin: parcalar[satir.sira],
        },
      })),
    });
  } catch (err) {
    // Compensating delete: don't leave a parent row with no chunks/vectors
    // behind for kurumBelgesiZatenVarMi to mistake for a finished document.
    await db.delete(schema.kurumBelgeParcalari).where(eq(schema.kurumBelgeParcalari.kurumBelgesiId, id));
    await db.delete(schema.kurumBelgeleri).where(eq(schema.kurumBelgeleri.id, id));
    throw err;
  }

  return { parcaSayisi: parcalar.length };
}

// ---------------------------------------------------------------------------
// Mevzuat insert (mirrors src/lib/mevzuat/index.ts — parcala.ts itself has
// no server-only import, so mevzuatMetniParcala is imported for real above).
// ---------------------------------------------------------------------------
async function mevzuatBelgesiEkle(params: {
  kanunKodu: string;
  kanunAdi: string;
  kurumId: string;
  rawText: string;
}): Promise<{ maddeSayisi: number }> {
  const maddeler = mevzuatMetniParcala(params.rawText, params.kanunKodu, params.kanunAdi);
  if (maddeler.length === 0) return { maddeSayisi: 0 };

  // Embedded before any row is written (ids are client-generated, so unlike
  // kurumBelgesiEkle this can just reorder rather than needing a
  // compensating delete) — a failed embed call must not leave madde rows
  // with no vector behind, since mevzuatZatenVarMi would then mistake the
  // document for already fully ingested on a re-run.
  const vektorler = await pasajGomVektorleri(maddeler.map((m) => `${m.baslik}\n${m.icerik}`));

  const idler = maddeler.map(() => randomUUID());
  await db.insert(schema.mevzuatMaddeleri).values(
    maddeler.map((m, i) => ({ id: idler[i], kodu: m.kodu, baslik: m.baslik, icerik: m.icerik, kurumId: params.kurumId }))
  );

  await koleksiyonlariHazirla();
  await qdrant.upsert(KOLEKSIYONLAR.mevzuat, {
    wait: true,
    points: maddeler.map((m, i) => ({
      id: idler[i],
      vector: vektorler[i],
      payload: { kurumId: params.kurumId, kodu: m.kodu, baslik: m.baslik, icerik: m.icerik },
    })),
  });

  return { maddeSayisi: maddeler.length };
}

/** Already-ingested check so a re-run skips work instead of duplicating it. */
async function mevzuatZatenVarMi(kurumId: string, kanunKodu: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.mevzuatMaddeleri.id })
    .from(schema.mevzuatMaddeleri)
    .where(
      and(
        eq(schema.mevzuatMaddeleri.kurumId, kurumId),
        or(eq(schema.mevzuatMaddeleri.kodu, kanunKodu), like(schema.mevzuatMaddeleri.kodu, `${kanunKodu}/%`))
      )
    )
    .limit(1);
  return !!row;
}

async function kurumBelgesiZatenVarMi(kurumId: string, dosyaAdi: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.kurumBelgeleri.id })
    .from(schema.kurumBelgeleri)
    .where(and(eq(schema.kurumBelgeleri.kurumId, kurumId), eq(schema.kurumBelgeleri.dosyaAdi, dosyaAdi)))
    .limit(1);
  return !!row;
}

/**
 * Routes a converted document to whichever corpus fits it: real "MADDE n"
 * structure (≥2 articles found) goes to the citable mevzuat corpus; anything
 * looser — a karar, genelge, circular with no article numbering — goes to
 * the knowledge base, which chunks generically instead of needing legal
 * article structure. Decided from the parsed content itself, per document.
 */
async function belgeyiIsle(params: {
  kurumId: string;
  kodu: string;
  baslik: string;
  dosyaAdi: string;
  rawText: string;
  yukleyenKullaniciId: string;
}): Promise<{ rota: "mevzuat" | "bilgi_tabani"; adet: number }> {
  const olasiMaddeler = mevzuatMetniParcala(params.rawText, params.kodu, params.baslik);

  if (olasiMaddeler.length >= 2) {
    const { maddeSayisi } = await mevzuatBelgesiEkle({
      kanunKodu: params.kodu,
      kanunAdi: params.baslik,
      kurumId: params.kurumId,
      rawText: params.rawText,
    });
    return { rota: "mevzuat", adet: maddeSayisi };
  }

  const { parcaSayisi } = await kurumBelgesiEkle({
    kurumId: params.kurumId,
    ad: params.baslik,
    dosyaAdi: params.dosyaAdi,
    rawText: params.rawText,
    yukleyenKullaniciId: params.yukleyenKullaniciId,
  });
  return { rota: "bilgi_tabani", adet: parcaSayisi };
}

// ---------------------------------------------------------------------------
// Kurum / birim / kullanıcı setup (mirrors src/lib/yonetim/index.ts +
// src/lib/birimler.ts — both server-only-gated, hand-copied for the same
// reason as above).
// ---------------------------------------------------------------------------
interface BirimTanimi {
  kod: string;
  ad: string;
  sdpBaslangic: string;
  sdpBitis: string;
  seviyeler: number[];
  aciklama: string;
}

interface KullaniciTanimi {
  kullaniciAdi: string;
  adSoyad: string;
  birimKod: string;
  rolId: "rol_memur" | "rol_sube_muduru" | "rol_daire_baskani";
}

interface KurumTanimi {
  id: string;
  ad: string;
  haberlesmeKodu: string;
  klasor: string;
  birimler: BirimTanimi[];
  kullanicilar: KullaniciTanimi[];
}

const KURUMLAR: KurumTanimi[] = [
  {
    id: "meb",
    ad: "Millî Eğitim Bakanlığı",
    haberlesmeKodu: "B.08.0.MEB.0.00.00.00",
    klasor: MEB_DIR,
    birimler: [
      {
        kod: "YZI",
        ad: "Yazı İşleri Müdürlüğü",
        sdpBaslangic: "805",
        sdpBitis: "805",
        seviyeler: [2],
        aciklama: "Genel evrak kabul, kayıt ve yönlendirme.",
      },
      {
        kod: "PER",
        ad: "Personel Genel Müdürlüğü",
        sdpBaslangic: "100",
        sdpBitis: "199",
        seviyeler: [2, 3],
        aciklama:
          "Öğretmen ve yönetici atama işlemleri, ders/ek ders saatlerine ilişkin kararların takibi, okullara yönelik idari kararlar (ör. ısınma amaçlı kömür dağıtımı).",
      },
    ],
    kullanicilar: [
      { kullaniciAdi: "memur_meb", adSoyad: "Elif Arslan", birimKod: "YZI", rolId: "rol_memur" },
      { kullaniciAdi: "mudur_meb", adSoyad: "Caner Yıldırım", birimKod: "YZI", rolId: "rol_sube_muduru" },
      // PER's onayZinciriSeviyeleri is [2,3] — baskan_meb alone can't move a
      // belge's approval chain past its first (seviye 2) step, so PER needs
      // its own şube müdürü too, not just YZI's.
      { kullaniciAdi: "mudur_meb_per", adSoyad: "Tolga Erdem", birimKod: "PER", rolId: "rol_sube_muduru" },
      { kullaniciAdi: "baskan_meb", adSoyad: "Nurcan Demirtaş", birimKod: "PER", rolId: "rol_daire_baskani" },
    ],
  },
  {
    id: "elazig_valiligi",
    ad: "Elazığ Valiliği",
    haberlesmeKodu: "B.05.4.VLK.0.23.00.00",
    klasor: VALILIK_DIR,
    birimler: [
      {
        kod: "YZI",
        ad: "Yazı İşleri Müdürlüğü",
        sdpBaslangic: "805",
        sdpBitis: "805",
        seviyeler: [2],
        aciklama: "Genel evrak kabul, kayıt, teşkilat yönetmeliği ve imza yetkileri yönergesi kapsamındaki işler.",
      },
      {
        kod: "KDGM",
        ad: "Kamu Düzeni ve Güvenlik Müdürlüğü",
        sdpBaslangic: "100",
        sdpBitis: "199",
        seviyeler: [2, 3],
        aciklama:
          "Trafik/taksi, sivil İHA, boğulma vakaları, hurdacılık, okul çevresi güvenliği ve mahalli çevre kurulu genel emirlerinin takibi.",
      },
    ],
    kullanicilar: [
      { kullaniciAdi: "memur_elazig", adSoyad: "Burak Şen", birimKod: "YZI", rolId: "rol_memur" },
      { kullaniciAdi: "mudur_elazig", adSoyad: "Gülşen Aktaş", birimKod: "YZI", rolId: "rol_sube_muduru" },
      { kullaniciAdi: "baskan_elazig", adSoyad: "İsmail Korkmaz", birimKod: "KDGM", rolId: "rol_daire_baskani" },
    ],
  },
];

async function birimGenelSablonunuGuncelle(birim: { id: string; kurumId: string; kod: string; ad: string; aciklama: string }) {
  const sablonId = `genel_${birim.id}`;
  const ad = `${birim.ad} - Genel Başvuru`;
  const taslakKurallari =
    `${birim.aciklama.trim()}\n\n` +
    `Cevap yazısı; başvurunun alındığını ve ${birim.ad}'ne iletildiğini belirtmeli, resmi ve kısa bir üslupla yazılmalı.`;

  await db
    .insert(schema.yazismaSablonlari)
    .values({
      id: sablonId,
      kurumId: birim.kurumId,
      evrakTuru: "genel_basvuru",
      ad,
      ilgiliBirimKodu: birim.kod,
      gerekliAlanlar: "[]",
      taslakKurallari,
    })
    .onConflictDoUpdate({
      target: schema.yazismaSablonlari.id,
      set: { ad, ilgiliBirimKodu: birim.kod, kurumId: birim.kurumId, taslakKurallari },
    });
}

const ROL_SEVIYE: Record<KullaniciTanimi["rolId"], number> = {
  rol_memur: 1,
  rol_sube_muduru: 2,
  rol_daire_baskani: 3,
};
const ROL_UNVAN: Record<KullaniciTanimi["rolId"], string> = {
  rol_memur: "Memur",
  rol_sube_muduru: "Şube Müdürü",
  rol_daire_baskani: "Daire Başkanı",
};

async function kurumKur(kurum: KurumTanimi): Promise<{ ilkYoneticiId: string }> {
  await db.insert(schema.kurumlar).values({ id: kurum.id, ad: kurum.ad, haberlesmeKodu: kurum.haberlesmeKodu }).onConflictDoNothing();

  for (const b of kurum.birimler) {
    const birimId = `${kurum.id}:${b.kod}`;
    await db
      .insert(schema.birimler)
      .values({
        id: birimId,
        kurumId: kurum.id,
        ad: b.ad,
        kod: b.kod,
        sdpKoduBaslangic: b.sdpBaslangic,
        sdpKoduBitis: b.sdpBitis,
        onayZinciriSeviyeleri: JSON.stringify(b.seviyeler),
        aciklama: b.aciklama,
      })
      .onConflictDoNothing();
    await birimGenelSablonunuGuncelle({ id: birimId, kurumId: kurum.id, kod: b.kod, ad: b.ad, aciklama: b.aciklama });
  }

  let ilkYoneticiId = "";
  for (const k of kurum.kullanicilar) {
    const id = randomUUID();
    const birimId = `${kurum.id}:${k.birimKod}`;
    const [eklendi] = await db
      .insert(schema.kullanicilar)
      .values({
        id,
        kullaniciAdi: k.kullaniciAdi,
        sifreHash: DEMO_SIFRE_HASH,
        adSoyad: k.adSoyad,
        kurumId: kurum.id,
        birimId,
        rolId: k.rolId,
        hiyerarsiSeviyesi: ROL_SEVIYE[k.rolId],
        unvan: ROL_UNVAN[k.rolId],
      })
      .onConflictDoNothing({ target: schema.kullanicilar.kullaniciAdi })
      .returning({ id: schema.kullanicilar.id });

    const kullaniciId = eklendi?.id ?? (await db.select({ id: schema.kullanicilar.id }).from(schema.kullanicilar).where(eq(schema.kullanicilar.kullaniciAdi, k.kullaniciAdi)))[0]?.id;
    if (k.rolId === "rol_daire_baskani" && kullaniciId) ilkYoneticiId = kullaniciId;
  }

  return { ilkYoneticiId };
}

// ---------------------------------------------------------------------------
// Per-kurum document lists.
// ---------------------------------------------------------------------------
interface BelgeGirdisi {
  kodu: string;
  baslikIpucu: string | null;
  dosyaYolu: string;
  dosyaAdi: string;
}

/**
 * The MEB folder has each Karar saved twice — once as "<no>.pdf" and once
 * under its full title as filename — confirmed byte-identical (same size)
 * for every pair. Group by size so each Karar is ingested exactly once,
 * preferring the numeric filename to read from and the descriptive one
 * (trimmed of its Resmî Gazete boilerplate tail) for the title.
 */
function mebBelgeleriniListele(): BelgeGirdisi[] {
  const dosyalar = readdirSync(MEB_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
  const gruplar = new Map<number, string[]>();
  for (const f of dosyalar) {
    const boyut = statSync(path.join(MEB_DIR, f)).size;
    const grup = gruplar.get(boyut) ?? [];
    grup.push(f);
    gruplar.set(boyut, grup);
  }

  const girdiler: BelgeGirdisi[] = [];
  for (const grup of gruplar.values()) {
    const numaraliAd = grup.find((f) => /^\d+\.pdf$/i.test(f));
    const aciklayiciAd = grup.find((f) => f !== numaraliAd);
    const dosyaAdi = numaraliAd ?? grup[0];
    const sayi = (numaraliAd ?? grup[0]).replace(/\.pdf$/i, "");

    const baslikIpucu = aciklayiciAd
      ? aciklayiciAd.replace(/\.pdf$/i, "").split(/Cumhurbaşkanı Kararları Tertip/)[0].trim()
      : null;

    girdiler.push({
      kodu: `MEB-${sayi}`,
      baslikIpucu,
      dosyaYolu: path.join(MEB_DIR, dosyaAdi),
      dosyaAdi,
    });
  }
  return girdiler.sort((a, b) => a.kodu.localeCompare(b.kodu));
}

function valilikBelgeleriniListele(): BelgeGirdisi[] {
  const dosyalar = readdirSync(VALILIK_DIR).filter((f) => f.toLowerCase().endsWith(".pdf"));
  return dosyalar.map((dosyaAdi) => ({
    kodu: `VAL-${dosyaAdi.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase()}`,
    baslikIpucu: null,
    dosyaYolu: path.join(VALILIK_DIR, dosyaAdi),
    dosyaAdi,
  }));
}

/** Content-derived title for documents with no reliable filename to lean on. */
function icerikten_baslik_cikar(rawText: string, yedek: string): string {
  const satirlar = rawText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const aday = satirlar[0];
  if (aday && aday.length >= 8 && aday.length <= 180 && !/^#{0,6}\s*$/.test(aday)) {
    return aday.replace(/^#+\s*/, "");
  }
  return yedek;
}

function dosyaAdindanBaslikUret(dosyaAdi: string): string {
  return dosyaAdi
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
interface SonucSatiri {
  kurum: string;
  dosyaAdi: string;
  baslik: string;
  rota: "mevzuat" | "bilgi_tabani" | "atlandi" | "hata";
  detay: string;
}

async function main() {
  const sonuclar: SonucSatiri[] = [];

  for (const kurumTanimi of KURUMLAR) {
    console.log(`\n=== ${kurumTanimi.ad} (${kurumTanimi.id}) ===`);
    const { ilkYoneticiId } = await kurumKur(kurumTanimi);
    const yukleyenKullaniciId =
      ilkYoneticiId ||
      (await db.select({ id: schema.kullanicilar.id }).from(schema.kullanicilar).where(eq(schema.kullanicilar.kurumId, kurumTanimi.id)).limit(1))[0]?.id;
    if (!yukleyenKullaniciId) throw new Error(`${kurumTanimi.id} için yükleyen kullanıcı bulunamadı.`);

    const belgeler = kurumTanimi.id === "meb" ? mebBelgeleriniListele() : valilikBelgeleriniListele();
    console.log(`${belgeler.length} belge bulundu.`);

    for (const belge of belgeler) {
      const baslangic = Date.now();
      try {
        if (await kurumBelgesiZatenVarMi(kurumTanimi.id, belge.dosyaAdi)) {
          console.log(`  [atlandı: bilgi tabanında zaten var] ${belge.dosyaAdi}`);
          sonuclar.push({ kurum: kurumTanimi.id, dosyaAdi: belge.dosyaAdi, baslik: belge.baslikIpucu ?? "", rota: "atlandi", detay: "kurum_belgesi mevcut" });
          continue;
        }
        if (await mevzuatZatenVarMi(kurumTanimi.id, belge.kodu)) {
          console.log(`  [atlandı: mevzuatta zaten var] ${belge.dosyaAdi}`);
          sonuclar.push({ kurum: kurumTanimi.id, dosyaAdi: belge.dosyaAdi, baslik: belge.baslikIpucu ?? "", rota: "atlandi", detay: "mevzuat mevcut" });
          continue;
        }

        console.log(`  -> ${belge.dosyaAdi} dönüştürülüyor (docling)...`);
        const rawText = await dosyadanMetinCikar(belge.dosyaYolu);

        const baslik = belge.baslikIpucu ?? icerikten_baslik_cikar(rawText, dosyaAdindanBaslikUret(belge.dosyaAdi));

        const { rota, adet } = await belgeyiIsle({
          kurumId: kurumTanimi.id,
          kodu: belge.kodu,
          baslik,
          dosyaAdi: belge.dosyaAdi,
          rawText,
          yukleyenKullaniciId,
        });

        const sure = ((Date.now() - baslangic) / 1000).toFixed(1);
        console.log(`     [${rota}] "${baslik}" — ${adet} ${rota === "mevzuat" ? "madde" : "parça"} (${sure}s)`);
        sonuclar.push({ kurum: kurumTanimi.id, dosyaAdi: belge.dosyaAdi, baslik, rota, detay: `${adet} ${rota === "mevzuat" ? "madde" : "parça"}` });
      } catch (err) {
        const mesaj = err instanceof Error ? err.message : String(err);
        console.error(`     [HATA] ${belge.dosyaAdi}: ${mesaj}`);
        sonuclar.push({ kurum: kurumTanimi.id, dosyaAdi: belge.dosyaAdi, baslik: belge.baslikIpucu ?? "", rota: "hata", detay: mesaj });
      }
    }
  }

  console.log("\n=== ÖZET (JSON) ===");
  console.log(JSON.stringify(sonuclar, null, 2));

  const hatali = sonuclar.filter((s) => s.rota === "hata");
  console.log(`\nToplam: ${sonuclar.length}, mevzuat: ${sonuclar.filter((s) => s.rota === "mevzuat").length}, bilgi_tabani: ${sonuclar.filter((s) => s.rota === "bilgi_tabani").length}, atlandı: ${sonuclar.filter((s) => s.rota === "atlandi").length}, hata: ${hatali.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });
