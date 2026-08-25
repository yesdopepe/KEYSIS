"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { oturumYoneticiZorunluKil } from "@/lib/auth/require-session";
import { kurumOlustur, kurumGuncelle } from "@/lib/yonetim";

async function auditYaz(kullanici: string, islem: string, detay: object = {}) {
  await db.insert(schema.auditLog).values({ islem, kullanici, detay: JSON.stringify(detay) });
}

export async function kurumOlusturAction(formData: FormData) {
  const session = await oturumYoneticiZorunluKil();

  const ad = String(formData.get("ad") ?? "").trim();
  const haberlesmeKodu = String(formData.get("haberlesme_kodu") ?? "").trim();
  const aciklama = String(formData.get("aciklama") ?? "").trim();
  if (!ad || !haberlesmeKodu) throw new Error("Kurum adı ve haberleşme kodu zorunludur.");

  const id = await kurumOlustur({ ad, haberlesmeKodu, aciklama });
  await auditYaz(session.kullaniciAdi, "kurum_olusturuldu", { kurumId: id, ad });

  revalidatePath("/yonetim/kurumlar");
}

export async function kurumGuncelleAction(kurumId: string, formData: FormData) {
  const session = await oturumYoneticiZorunluKil();

  const ad = String(formData.get("ad") ?? "").trim();
  const haberlesmeKodu = String(formData.get("haberlesme_kodu") ?? "").trim();
  const aciklama = String(formData.get("aciklama") ?? "").trim();
  if (!ad || !haberlesmeKodu) throw new Error("Kurum adı ve haberleşme kodu zorunludur.");

  await kurumGuncelle(kurumId, { ad, haberlesmeKodu, aciklama });
  await auditYaz(session.kullaniciAdi, "kurum_guncellendi", { kurumId });

  revalidatePath("/yonetim/kurumlar");
  revalidatePath(`/yonetim/kurumlar/${kurumId}`);
}
