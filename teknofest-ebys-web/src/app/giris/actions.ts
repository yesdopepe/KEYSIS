"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth/session";

export async function girisYap(_prevState: unknown, formData: FormData) {
  const kullaniciAdi = String(formData.get("kullanici_adi") ?? "").trim();
  const sifre = String(formData.get("sifre") ?? "");

  const [kullanici] = await db
    .select()
    .from(schema.kullanicilar)
    .where(eq(schema.kullanicilar.kullaniciAdi, kullaniciAdi));

  if (!kullanici || !bcrypt.compareSync(sifre, kullanici.sifreHash)) {
    return { hata: "Kullanıcı adı veya şifre hatalı." };
  }
  if (!kullanici.aktifMi) {
    return { hata: "Bu kullanıcı hesabı devre dışı bırakılmış." };
  }

  let mevzuatYonetimi = false;
  let bilgiTabaniYonetimi = false;
  if (kullanici.rolId) {
    const [rol] = await db.select().from(schema.roller).where(eq(schema.roller.id, kullanici.rolId));
    mevzuatYonetimi = rol?.mevzuatYonetimi ?? false;
    bilgiTabaniYonetimi = rol?.bilgiTabaniYonetimi ?? false;
  }

  await createSession({
    userId: kullanici.id,
    kullaniciAdi: kullanici.kullaniciAdi,
    adSoyad: kullanici.adSoyad,
    kurumId: kullanici.kurumId,
    birimId: kullanici.birimId,
    hiyerarsiSeviyesi: kullanici.hiyerarsiSeviyesi,
    unvan: kullanici.unvan,
    sistemYoneticisiMi: kullanici.sistemYoneticisiMi,
    mevzuatYonetimi,
    bilgiTabaniYonetimi,
  });

  redirect(kullanici.sistemYoneticisiMi ? "/yonetim" : "/panel");
}

export async function cikisYap() {
  await destroySession();
  redirect("/giris");
}
