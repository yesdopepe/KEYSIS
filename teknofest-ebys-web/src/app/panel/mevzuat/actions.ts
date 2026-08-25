"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { oturumIzinliKil } from "@/lib/auth/require-session";
import { dosyadanMetinCikar } from "@/lib/docling";
import { mevzuatBelgesiEkle, mevzuatMaddesiEkle, mevzuatMaddesiSil } from "@/lib/mevzuat";

/**
 * A "tüm kurumlar" entry is visible to every institution, so it has to be an
 * explicit choice rather than the default — a cross-tenant write should never
 * be the path of least resistance.
 */
function kapsamCoz(formData: FormData, kurumId: string): string | null {
  return formData.get("tum_kurumlar") ? null : kurumId;
}

export async function mevzuatYukle(formData: FormData) {
  const session = await oturumIzinliKil("mevzuatYonetimi");

  const kanunKodu = String(formData.get("kanun_kodu") ?? "").trim();
  const kanunAdi = String(formData.get("kanun_adi") ?? "").trim();
  const yapistirilanMetin = String(formData.get("metin") ?? "").trim();
  const dosya = formData.get("dosya");

  if (!kanunKodu) throw new Error("Kanun/yönetmelik numarası zorunludur.");
  if (!kanunAdi) throw new Error("Kanun/yönetmelik adı zorunludur.");

  let rawText = yapistirilanMetin;
  if (dosya instanceof File && dosya.size > 0) {
    rawText = `${rawText}\n\n${await dosyadanMetinCikar(dosya)}`.trim();
  }
  if (!rawText) throw new Error("Bir dosya yükleyin veya metni yapıştırın.");

  const kurumId = kapsamCoz(formData, session.kurumId);
  const { maddeSayisi } = await mevzuatBelgesiEkle({
    kanunKodu,
    kanunAdi,
    kurumId,
    rawText,
  });

  await db.insert(schema.auditLog).values({
    islem: "mevzuat_yuklendi",
    kullanici: session.kullaniciAdi,
    detay: JSON.stringify({ kanunKodu, kanunAdi, maddeSayisi, tumKurumlar: kurumId === null }),
  });

  revalidatePath("/panel/mevzuat");
}

/** Manual single-article entry — for fixing one bad split without re-uploading. */
export async function mevzuatMaddesiEkleAction(formData: FormData) {
  const session = await oturumIzinliKil("mevzuatYonetimi");

  const kodu = String(formData.get("kodu") ?? "").trim();
  const baslik = String(formData.get("baslik") ?? "").trim();
  const icerik = String(formData.get("icerik") ?? "").trim();

  if (!kodu) throw new Error("Madde kodu zorunludur.");
  if (!baslik) throw new Error("Madde başlığı zorunludur.");
  if (!icerik) throw new Error("Madde içeriği zorunludur.");

  const kurumId = kapsamCoz(formData, session.kurumId);
  await mevzuatMaddesiEkle({ kodu, baslik, icerik, kurumId });

  await db.insert(schema.auditLog).values({
    islem: "mevzuat_maddesi_eklendi",
    kullanici: session.kullaniciAdi,
    detay: JSON.stringify({ kodu, tumKurumlar: kurumId === null }),
  });

  revalidatePath("/panel/mevzuat");
}

export async function mevzuatMaddesiKaldir(maddeId: string) {
  const session = await oturumIzinliKil("mevzuatYonetimi");
  await mevzuatMaddesiSil(session.kurumId, maddeId);

  await db.insert(schema.auditLog).values({
    islem: "mevzuat_maddesi_silindi",
    kullanici: session.kullaniciAdi,
    detay: JSON.stringify({ maddeId }),
  });

  revalidatePath("/panel/mevzuat");
}
