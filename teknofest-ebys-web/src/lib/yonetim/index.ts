import "server-only";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { birimGenelSablonunuGuncelle } from "@/lib/birimler";
import { rolDegisikliginiYay } from "@/lib/roller";

// --- Kurumlar ---

export async function kurumOlustur(params: {
  ad: string;
  haberlesmeKodu: string;
  aciklama?: string;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.kurumlar).values({
    id,
    ad: params.ad,
    haberlesmeKodu: params.haberlesmeKodu,
    aciklama: params.aciklama || null,
  });
  return id;
}

export async function kurumGuncelle(
  id: string,
  params: { ad: string; haberlesmeKodu: string; aciklama?: string }
): Promise<void> {
  await db
    .update(schema.kurumlar)
    .set({ ad: params.ad, haberlesmeKodu: params.haberlesmeKodu, aciklama: params.aciklama || null })
    .where(eq(schema.kurumlar.id, id));
}

// --- Birimler ---

interface BirimGirdisi {
  kurumId: string;
  ad: string;
  kod: string;
  parentBirimId?: string;
  sdpKoduBaslangic?: string;
  sdpKoduBitis?: string;
  onayZinciriSeviyeleri: number[];
  aciklama?: string;
}

export async function birimOlustur(params: BirimGirdisi): Promise<string> {
  const [mevcut] = await db
    .select({ id: schema.birimler.id })
    .from(schema.birimler)
    .where(and(eq(schema.birimler.kurumId, params.kurumId), eq(schema.birimler.kod, params.kod)));
  if (mevcut) throw new Error(`Bu kurumda "${params.kod}" koduyla bir birim zaten var.`);

  const id = `${params.kurumId}:${params.kod}`;
  await db.insert(schema.birimler).values({
    id,
    kurumId: params.kurumId,
    ad: params.ad,
    kod: params.kod,
    parentBirimId: params.parentBirimId || null,
    sdpKoduBaslangic: params.sdpKoduBaslangic || null,
    sdpKoduBitis: params.sdpKoduBitis || null,
    onayZinciriSeviyeleri: JSON.stringify(params.onayZinciriSeviyeleri),
    aciklama: params.aciklama || null,
  });

  await birimGenelSablonunuGuncelle({
    id,
    kurumId: params.kurumId,
    kod: params.kod,
    ad: params.ad,
    aciklama: params.aciklama || null,
  });

  return id;
}

export async function birimGuncelle(id: string, params: BirimGirdisi): Promise<void> {
  const [cakisan] = await db
    .select({ id: schema.birimler.id })
    .from(schema.birimler)
    .where(and(eq(schema.birimler.kurumId, params.kurumId), eq(schema.birimler.kod, params.kod)));
  if (cakisan && cakisan.id !== id) {
    throw new Error(`Bu kurumda "${params.kod}" koduyla başka bir birim zaten var.`);
  }

  await db
    .update(schema.birimler)
    .set({
      ad: params.ad,
      kod: params.kod,
      parentBirimId: params.parentBirimId || null,
      sdpKoduBaslangic: params.sdpKoduBaslangic || null,
      sdpKoduBitis: params.sdpKoduBitis || null,
      onayZinciriSeviyeleri: JSON.stringify(params.onayZinciriSeviyeleri),
      aciklama: params.aciklama || null,
    })
    .where(eq(schema.birimler.id, id));

  await birimGenelSablonunuGuncelle({
    id,
    kurumId: params.kurumId,
    kod: params.kod,
    ad: params.ad,
    aciklama: params.aciklama || null,
  });
}

// --- Kullanıcılar ---

export async function kullaniciOlustur(params: {
  kullaniciAdi: string;
  sifre: string;
  adSoyad: string;
  kurumId: string;
  birimId: string;
  rolId?: string;
  hiyerarsiSeviyesi?: number;
  unvan?: string;
}): Promise<string> {
  const [mevcut] = await db
    .select({ id: schema.kullanicilar.id })
    .from(schema.kullanicilar)
    .where(eq(schema.kullanicilar.kullaniciAdi, params.kullaniciAdi));
  if (mevcut) throw new Error("Bu kullanıcı adı zaten kullanılıyor.");

  const id = randomUUID();
  const sifreHash = bcrypt.hashSync(params.sifre, 10);

  if (params.rolId) {
    const [rol] = await db.select().from(schema.roller).where(eq(schema.roller.id, params.rolId));
    if (!rol) throw new Error("Rol bulunamadı.");
    await db.insert(schema.kullanicilar).values({
      id,
      kullaniciAdi: params.kullaniciAdi,
      sifreHash,
      adSoyad: params.adSoyad,
      kurumId: params.kurumId,
      birimId: params.birimId,
      rolId: rol.id,
      hiyerarsiSeviyesi: rol.onaySeviyesi ?? 1,
      unvan: rol.ad,
    });
  } else {
    await db.insert(schema.kullanicilar).values({
      id,
      kullaniciAdi: params.kullaniciAdi,
      sifreHash,
      adSoyad: params.adSoyad,
      kurumId: params.kurumId,
      birimId: params.birimId,
      hiyerarsiSeviyesi: params.hiyerarsiSeviyesi ?? 1,
      unvan: params.unvan || "Memur",
    });
  }

  return id;
}

// --- Roller ---

interface RolGirdisi {
  ad: string;
  aciklama?: string;
  onaySeviyesi: number | null;
  mevzuatYonetimi: boolean;
  bilgiTabaniYonetimi: boolean;
}

export async function rolOlustur(params: RolGirdisi): Promise<string> {
  const id = randomUUID();
  await db.insert(schema.roller).values({
    id,
    ad: params.ad,
    aciklama: params.aciklama || null,
    onaySeviyesi: params.onaySeviyesi,
    mevzuatYonetimi: params.mevzuatYonetimi,
    bilgiTabaniYonetimi: params.bilgiTabaniYonetimi,
  });
  return id;
}

export async function rolGuncelle(id: string, params: RolGirdisi): Promise<void> {
  await db
    .update(schema.roller)
    .set({
      ad: params.ad,
      aciklama: params.aciklama || null,
      onaySeviyesi: params.onaySeviyesi,
      mevzuatYonetimi: params.mevzuatYonetimi,
      bilgiTabaniYonetimi: params.bilgiTabaniYonetimi,
    })
    .where(eq(schema.roller.id, id));

  // Users assigned this role before the edit must not silently go stale —
  // see lib/roller.ts.
  await rolDegisikliginiYay(id);
}

/** Refuses to delete a role that's still assigned to someone, rather than
 * letting the raw foreign-key violation surface. */
export async function rolSil(id: string): Promise<void> {
  const [{ adet }] = await db
    .select({ adet: count() })
    .from(schema.kullanicilar)
    .where(eq(schema.kullanicilar.rolId, id));
  if (adet > 0) {
    throw new Error(`Bu role atanmış ${adet} kullanıcı var — önce onları başka bir role atayın.`);
  }
  await db.delete(schema.roller).where(eq(schema.roller.id, id));
}
