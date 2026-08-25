import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { metniParcala } from "@/lib/bilgi-tabani";
import { dosyadanMetinCikar } from "@/lib/docling";
import {
  KOLEKSIYONLAR,
  ara,
  noktalariEkle,
  noktalariFiltreyleSil,
  pasajGomVektorleri,
  sorguGomVektoru,
} from "@/lib/vektor/qdrant";

/**
 * Saved conversations and their attachments.
 *
 * Two isolation rules hold throughout this module:
 *  1. A conversation is resolved by (id, kullaniciId, kurumId) together — an
 *     id alone arrives from the client and is not trusted.
 *  2. Attachment chunks live in their own Qdrant collection scoped to
 *     sohbetId, so a file uploaded to one conversation can never appear in an
 *     institution-wide knowledge base search.
 */

const VERI_DIZINI = path.dirname(process.env.DATABASE_PATH ?? "./data/ebys.db");

export interface SohbetSahibi {
  userId: string;
  kurumId: string;
  birimId: string;
}

/** Resolves a conversation only if this exact user in this institution owns it. */
export async function sohbetGetir(sahip: SohbetSahibi, sohbetId: string) {
  const [sohbet] = await db
    .select()
    .from(schema.sohbetler)
    .where(
      and(
        eq(schema.sohbetler.id, sohbetId),
        eq(schema.sohbetler.kullaniciId, sahip.userId),
        eq(schema.sohbetler.kurumId, sahip.kurumId)
      )
    );
  return sohbet ?? null;
}

export async function sohbetleriListele(sahip: SohbetSahibi) {
  return db
    .select({
      id: schema.sohbetler.id,
      baslik: schema.sohbetler.baslik,
      guncellemeZamani: schema.sohbetler.guncellemeZamani,
    })
    .from(schema.sohbetler)
    .where(
      and(
        eq(schema.sohbetler.kullaniciId, sahip.userId),
        eq(schema.sohbetler.kurumId, sahip.kurumId)
      )
    )
    .orderBy(desc(schema.sohbetler.guncellemeZamani));
}

export async function sohbetOlustur(
  sahip: SohbetSahibi,
  sohbetId: string,
  baslik = "Yeni sohbet"
) {
  await db.insert(schema.sohbetler).values({
    id: sohbetId,
    baslik,
    kullaniciId: sahip.userId,
    kurumId: sahip.kurumId,
    birimId: sahip.birimId,
  });
}

/** Creates the conversation on first use so a chat id is usable immediately. */
export async function sohbetiSagla(
  sahip: SohbetSahibi,
  sohbetId: string
): Promise<void> {
  const mevcut = await sohbetGetir(sahip, sohbetId);
  if (!mevcut) await sohbetOlustur(sahip, sohbetId);
}

export interface KayitliMesaj {
  id: string;
  rol: string;
  parcalar: unknown[];
}

export async function mesajlariGetir(
  sahip: SohbetSahibi,
  sohbetId: string
): Promise<KayitliMesaj[]> {
  const sohbet = await sohbetGetir(sahip, sohbetId);
  if (!sohbet) return [];

  const satirlar = await db
    .select()
    .from(schema.sohbetMesajlari)
    .where(eq(schema.sohbetMesajlari.sohbetId, sohbetId))
    .orderBy(schema.sohbetMesajlari.sira);

  return satirlar.map((s) => ({
    id: s.id,
    rol: s.rol,
    parcalar: JSON.parse(s.parcalar) as unknown[],
  }));
}

/**
 * Replaces the whole message history for a conversation. The assistant may
 * revise earlier parts of a message as it streams, so rewriting the thread is
 * simpler and less error-prone than diffing it.
 */
export async function mesajlariKaydet(
  sahip: SohbetSahibi,
  sohbetId: string,
  mesajlar: { id: string; role: string; parts: unknown[] }[]
): Promise<void> {
  const sohbet = await sohbetGetir(sahip, sohbetId);
  if (!sohbet) return;

  await db.delete(schema.sohbetMesajlari).where(eq(schema.sohbetMesajlari.sohbetId, sohbetId));

  if (mesajlar.length > 0) {
    await db.insert(schema.sohbetMesajlari).values(
      mesajlar.map((m, sira) => ({
        id: m.id || randomUUID(),
        sohbetId,
        kurumId: sahip.kurumId,
        rol: m.role,
        sira,
        parcalar: JSON.stringify(m.parts),
      }))
    );
  }

  await db
    .update(schema.sohbetler)
    .set({ guncellemeZamani: new Date() })
    .where(eq(schema.sohbetler.id, sohbetId));
}

export async function sohbetiYenidenAdlandir(
  sahip: SohbetSahibi,
  sohbetId: string,
  baslik: string
): Promise<void> {
  await db
    .update(schema.sohbetler)
    .set({ baslik, guncellemeZamani: new Date() })
    .where(
      and(
        eq(schema.sohbetler.id, sohbetId),
        eq(schema.sohbetler.kullaniciId, sahip.userId),
        eq(schema.sohbetler.kurumId, sahip.kurumId)
      )
    );
}

/** Deletes the conversation and everything attached to it: rows, files, vectors. */
export async function sohbetiSil(sahip: SohbetSahibi, sohbetId: string): Promise<void> {
  const sohbet = await sohbetGetir(sahip, sohbetId);
  if (!sohbet) return;

  const ekler = await db
    .select()
    .from(schema.sohbetEkleri)
    .where(eq(schema.sohbetEkleri.sohbetId, sohbetId));

  await noktalariFiltreyleSil(KOLEKSIYONLAR.sohbetEkleri, {
    sohbetId,
    kurumId: sahip.kurumId,
  });

  for (const ek of ekler) {
    // A missing file must not block deleting the record it belongs to.
    await unlink(path.join(VERI_DIZINI, ek.diskYolu)).catch(() => {});
  }

  await db.delete(schema.sohbetEkleri).where(eq(schema.sohbetEkleri.sohbetId, sohbetId));
  await db.delete(schema.sohbetMesajlari).where(eq(schema.sohbetMesajlari.sohbetId, sohbetId));
  await db.delete(schema.sohbetler).where(eq(schema.sohbetler.id, sohbetId));
}

export interface EklenenEk {
  id: string;
  ad: string;
  tur: "gorsel" | "belge";
  mimeTur: string;
  url: string;
  parcaSayisi: number;
}

/**
 * Stores one attachment. Images are kept as-is for the vision model; other
 * documents are converted to text, chunked and embedded into this
 * conversation's own vector namespace.
 */
export async function sohbetEkiEkle(
  sahip: SohbetSahibi,
  sohbetId: string,
  dosya: File
): Promise<EklenenEk> {
  const sohbet = await sohbetGetir(sahip, sohbetId);
  if (!sohbet) throw new Error("Sohbet bulunamadı.");

  const ekId = randomUUID();
  const gorselMi = dosya.type.startsWith("image/");
  const uzanti = path.extname(dosya.name);

  const goreliYol = path.join("sohbet-ekleri", sohbetId, `${ekId}${uzanti}`);
  const tamYol = path.join(VERI_DIZINI, goreliYol);
  await mkdir(path.dirname(tamYol), { recursive: true });
  await writeFile(tamYol, Buffer.from(await dosya.arrayBuffer()));

  let rawText: string | null = null;
  let parcaSayisi = 0;

  if (!gorselMi) {
    rawText = await dosyadanMetinCikar(dosya);
    const parcalar = metniParcala(rawText);

    if (parcalar.length > 0) {
      const vektorler = await pasajGomVektorleri(parcalar);
      await noktalariEkle(
        KOLEKSIYONLAR.sohbetEkleri,
        parcalar.map((metin, sira) => ({
          // Qdrant only accepts an unsigned integer or a UUID as a point id;
          // chunks are removed by payload filter, so it need not be derivable.
          id: randomUUID(),
          vector: vektorler[sira],
          payload: {
            sohbetId,
            kurumId: sahip.kurumId,
            ekId,
            ad: dosya.name,
            sira,
            metin,
          },
        }))
      );
      parcaSayisi = parcalar.length;
    }
  }

  await db.insert(schema.sohbetEkleri).values({
    id: ekId,
    sohbetId,
    kurumId: sahip.kurumId,
    kullaniciId: sahip.userId,
    ad: dosya.name,
    dosyaAdi: dosya.name,
    mimeTur: dosya.type || "application/octet-stream",
    diskYolu: goreliYol,
    rawText,
    tur: gorselMi ? "gorsel" : "belge",
  });

  return {
    id: ekId,
    ad: dosya.name,
    tur: gorselMi ? "gorsel" : "belge",
    mimeTur: dosya.type || "application/octet-stream",
    url: `/api/sohbet/${sohbetId}/ek/${ekId}`,
    parcaSayisi,
  };
}

export async function sohbetEkleriniListele(sahip: SohbetSahibi, sohbetId: string) {
  const sohbet = await sohbetGetir(sahip, sohbetId);
  if (!sohbet) return [];

  return db
    .select({
      id: schema.sohbetEkleri.id,
      ad: schema.sohbetEkleri.ad,
      tur: schema.sohbetEkleri.tur,
      mimeTur: schema.sohbetEkleri.mimeTur,
    })
    .from(schema.sohbetEkleri)
    .where(eq(schema.sohbetEkleri.sohbetId, sohbetId))
    .orderBy(schema.sohbetEkleri.zaman);
}

/** Resolves one attachment for the authenticated file-serving route. */
export async function sohbetEkiGetir(sahip: SohbetSahibi, sohbetId: string, ekId: string) {
  const [ek] = await db
    .select()
    .from(schema.sohbetEkleri)
    .where(
      and(
        eq(schema.sohbetEkleri.id, ekId),
        eq(schema.sohbetEkleri.sohbetId, sohbetId),
        eq(schema.sohbetEkleri.kurumId, sahip.kurumId),
        eq(schema.sohbetEkleri.kullaniciId, sahip.userId)
      )
    );
  if (!ek) return null;
  return { ek, tamYol: path.join(VERI_DIZINI, ek.diskYolu) };
}

export interface SohbetEkiSonucu {
  ad: string;
  parcaNo: number;
  metin: string;
  skor: number;
}

/**
 * Searches only the attachments of one conversation. Both sohbetId and
 * kurumId are required filters: sohbetId comes from the validated session
 * record, never from a model-supplied tool argument.
 */
export async function sohbetEkindeAra(
  kurumId: string,
  sohbetId: string,
  sorgu: string,
  topK = 4
): Promise<SohbetEkiSonucu[]> {
  const vektor = await sorguGomVektoru(sorgu);
  const sonuclar = await ara(
    KOLEKSIYONLAR.sohbetEkleri,
    vektor,
    { must: { sohbetId, kurumId } },
    topK
  );

  return sonuclar.map((s) => ({
    ad: String(s.payload.ad ?? ""),
    parcaNo: Number(s.payload.sira ?? 0) + 1,
    metin: String(s.payload.metin ?? ""),
    skor: Number(s.skor.toFixed(3)),
  }));
}
