"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { oturumIzinliKil } from "@/lib/auth/require-session";
import { kurumBelgesiEkle, kurumBelgesiSil } from "@/lib/bilgi-tabani";
import { dosyadanMetinCikar } from "@/lib/docling";

export async function kurumBelgesiYukle(formData: FormData) {
  const session = await oturumIzinliKil("bilgiTabaniYonetimi");

  const ad = String(formData.get("ad") ?? "").trim();
  const yapistirilanMetin = String(formData.get("metin") ?? "").trim();
  const dosya = formData.get("dosya");

  if (!ad) throw new Error("Belge adı zorunludur.");

  let rawText = yapistirilanMetin;
  let dosyaAdi: string | undefined;

  if (dosya instanceof File && dosya.size > 0) {
    rawText = `${rawText}\n\n${await dosyadanMetinCikar(dosya)}`.trim();
    dosyaAdi = dosya.name;
  }

  if (!rawText) throw new Error("Bir dosya yükleyin veya metni yapıştırın.");

  const { parcaSayisi } = await kurumBelgesiEkle({
    kurumId: session.kurumId,
    ad,
    dosyaAdi,
    rawText,
    yukleyenKullaniciId: session.userId,
  });

  await db.insert(schema.auditLog).values({
    islem: "kurum_belgesi_yuklendi",
    kullanici: session.kullaniciAdi,
    detay: JSON.stringify({ ad, dosyaAdi, parcaSayisi }),
  });

  revalidatePath("/panel/kurum-belgeleri");
}

export async function kurumBelgesiKaldir(belgeId: string) {
  const session = await oturumIzinliKil("bilgiTabaniYonetimi");
  await kurumBelgesiSil(session.kurumId, belgeId);
  await db.insert(schema.auditLog).values({
    islem: "kurum_belgesi_silindi",
    kullanici: session.kullaniciAdi,
    detay: JSON.stringify({ belgeId }),
  });
  revalidatePath("/panel/kurum-belgeleri");
}
