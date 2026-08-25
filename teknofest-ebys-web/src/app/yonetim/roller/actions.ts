"use server";

import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { oturumYoneticiZorunluKil } from "@/lib/auth/require-session";
import { rolOlustur, rolGuncelle, rolSil } from "@/lib/yonetim";

async function auditYaz(kullanici: string, islem: string, detay: object = {}) {
  await db.insert(schema.auditLog).values({ islem, kullanici, detay: JSON.stringify(detay) });
}

function rolAlanlariniOku(formData: FormData) {
  const ad = String(formData.get("ad") ?? "").trim();
  if (!ad) throw new Error("Rol adı zorunludur.");
  const aciklama = String(formData.get("aciklama") ?? "").trim();
  const onaySeviyesiHam = String(formData.get("onay_seviyesi") ?? "").trim();
  const onaySeviyesi = onaySeviyesiHam ? Number(onaySeviyesiHam) : null;
  return {
    ad,
    aciklama,
    onaySeviyesi,
    mevzuatYonetimi: formData.get("mevzuat_yonetimi") === "on",
    bilgiTabaniYonetimi: formData.get("bilgi_tabani_yonetimi") === "on",
  };
}

export async function rolOlusturAction(formData: FormData) {
  const session = await oturumYoneticiZorunluKil();
  const params = rolAlanlariniOku(formData);
  const id = await rolOlustur(params);
  await auditYaz(session.kullaniciAdi, "rol_olusturuldu", { rolId: id, ad: params.ad });
  revalidatePath("/yonetim/roller");
}

export async function rolGuncelleAction(rolId: string, formData: FormData) {
  const session = await oturumYoneticiZorunluKil();
  const params = rolAlanlariniOku(formData);
  await rolGuncelle(rolId, params);
  await auditYaz(session.kullaniciAdi, "rol_guncellendi", { rolId });
  revalidatePath("/yonetim/roller");
}

export async function rolSilAction(rolId: string) {
  const session = await oturumYoneticiZorunluKil();
  await rolSil(rolId);
  await auditYaz(session.kullaniciAdi, "rol_silindi", { rolId });
  revalidatePath("/yonetim/roller");
}
