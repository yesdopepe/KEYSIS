"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { oturumYoneticiZorunluKil } from "@/lib/auth/require-session";
import { birimOlustur, birimGuncelle, kullaniciOlustur } from "@/lib/yonetim";
import { kullaniciRolAta } from "@/lib/roller";

async function auditYaz(kullanici: string, islem: string, detay: object = {}) {
  await db.insert(schema.auditLog).values({ islem, kullanici, detay: JSON.stringify(detay) });
}

function seviyeleriOku(formData: FormData): number[] {
  return formData
    .getAll("seviye")
    .map((v) => Number(v))
    .filter((n) => n === 1 || n === 2 || n === 3)
    .sort((a, b) => a - b);
}

export async function birimOlusturAction(kurumId: string, formData: FormData) {
  const session = await oturumYoneticiZorunluKil();

  const ad = String(formData.get("ad") ?? "").trim();
  const kod = String(formData.get("kod") ?? "").trim().toUpperCase();
  if (!ad || !kod) throw new Error("Birim adı ve kodu zorunludur.");

  const parentBirimId = String(formData.get("parent_birim_id") ?? "").trim();
  const sdpKoduBaslangic = String(formData.get("sdp_kodu_baslangic") ?? "").trim();
  const sdpKoduBitis = String(formData.get("sdp_kodu_bitis") ?? "").trim();
  const aciklama = String(formData.get("aciklama") ?? "").trim();
  const seviyeler = seviyeleriOku(formData);
  if (seviyeler.length === 0) throw new Error("Onay zincirinde en az bir hiyerarşi seviyesi seçilmelidir.");

  const id = await birimOlustur({
    kurumId,
    ad,
    kod,
    parentBirimId: parentBirimId || undefined,
    sdpKoduBaslangic: sdpKoduBaslangic || undefined,
    sdpKoduBitis: sdpKoduBitis || undefined,
    onayZinciriSeviyeleri: seviyeler,
    aciklama,
  });
  await auditYaz(session.kullaniciAdi, "birim_olusturuldu", { birimId: id, ad });

  revalidatePath(`/yonetim/kurumlar/${kurumId}`);
}

export async function birimGuncelleAction(birimId: string, kurumId: string, formData: FormData) {
  const session = await oturumYoneticiZorunluKil();

  const ad = String(formData.get("ad") ?? "").trim();
  const kod = String(formData.get("kod") ?? "").trim().toUpperCase();
  if (!ad || !kod) throw new Error("Birim adı ve kodu zorunludur.");

  const parentBirimId = String(formData.get("parent_birim_id") ?? "").trim();
  const sdpKoduBaslangic = String(formData.get("sdp_kodu_baslangic") ?? "").trim();
  const sdpKoduBitis = String(formData.get("sdp_kodu_bitis") ?? "").trim();
  const aciklama = String(formData.get("aciklama") ?? "").trim();
  const seviyeler = seviyeleriOku(formData);
  if (seviyeler.length === 0) throw new Error("Onay zincirinde en az bir hiyerarşi seviyesi seçilmelidir.");

  await birimGuncelle(birimId, {
    kurumId,
    ad,
    kod,
    parentBirimId: parentBirimId || undefined,
    sdpKoduBaslangic: sdpKoduBaslangic || undefined,
    sdpKoduBitis: sdpKoduBitis || undefined,
    onayZinciriSeviyeleri: seviyeler,
    aciklama,
  });
  await auditYaz(session.kullaniciAdi, "birim_guncellendi", { birimId });

  revalidatePath(`/yonetim/kurumlar/${kurumId}`);
  revalidatePath("/yonetim/birimler");
}

export async function kullaniciOlusturAction(kurumId: string, birimId: string, formData: FormData) {
  const session = await oturumYoneticiZorunluKil();

  const kullaniciAdi = String(formData.get("kullanici_adi") ?? "").trim();
  const sifre = String(formData.get("sifre") ?? "");
  const adSoyad = String(formData.get("ad_soyad") ?? "").trim();
  if (!kullaniciAdi || !sifre || !adSoyad) {
    throw new Error("Kullanıcı adı, şifre ve ad soyad zorunludur.");
  }

  const rolId = String(formData.get("rol_id") ?? "").trim();
  const hiyerarsiSeviyesi = Number(formData.get("hiyerarsi_seviyesi") ?? 1);
  const unvan = String(formData.get("unvan") ?? "").trim();

  const id = await kullaniciOlustur({
    kullaniciAdi,
    sifre,
    adSoyad,
    kurumId,
    birimId,
    rolId: rolId || undefined,
    hiyerarsiSeviyesi: rolId ? undefined : hiyerarsiSeviyesi,
    unvan: rolId ? undefined : unvan,
  });
  await auditYaz(session.kullaniciAdi, "kullanici_olusturuldu", { kullaniciId: id, kullaniciAdi });

  revalidatePath("/yonetim/birimler");
}

export async function kullaniciRolGuncelleAction(kullaniciId: string, birimId: string, formData: FormData) {
  const session = await oturumYoneticiZorunluKil();

  const rolId = String(formData.get("rol_id") ?? "").trim();
  if (!rolId) throw new Error("Bir rol seçilmelidir.");

  await kullaniciRolAta(kullaniciId, rolId);
  await auditYaz(session.kullaniciAdi, "kullanici_rolu_guncellendi", { kullaniciId, rolId });

  revalidatePath("/yonetim/birimler");
}
