"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { taslakOlustur } from "@/lib/agents/writer";
import { yanitTaslagiCoz, type YanitTaslagi } from "@/lib/belgeler/yanit-taslagi";
import { oneriEkle, oneriGetir, oneriKararKaydet } from "@/lib/belgeler/oneriler";
import { belgeOnerisiOlustur } from "@/lib/agents/belge-yazar";
import { onayZinciriOlustur, onayZinciriSifirla, adimKararVer, havaleKaydet } from "@/lib/onay";
import type { MevzuatEslesmesi } from "@/lib/agents/reader";

async function auditYaz(evrakId: string, islem: string, kullanici: string, detay: object = {}) {
  await db.insert(schema.auditLog).values({ evrakId, islem, kullanici, detay: JSON.stringify(detay) });
}

async function evrakGetirVeYetkiKontrol(evrakId: string) {
  const session = await oturumZorunluKil();
  const [evrak] = await db.select().from(schema.evraklar).where(eq(schema.evraklar.id, evrakId));
  if (!evrak) throw new Error("Evrak bulunamadı.");
  if (evrak.birimId !== session.birimId) throw new Error("Bu evrak sizin biriminize ait değil.");
  return { session, evrak };
}

/**
 * HITL #1 — clerk confirms the AI's classification/analysis. Triggers the
 * Writer agent and generates the responsible birim's approval chain.
 */
export async function hitlOnayla(evrakId: string) {
  const { session, evrak } = await evrakGetirVeYetkiKontrol(evrakId);
  if (evrak.durum !== "ic_incelemede") throw new Error("Bu evrak inceleme aşamasında değil.");
  if (!evrak.kurumId || !evrak.birimId) throw new Error("Evrak henüz sınıflandırılmamış.");

  await auditYaz(evrakId, "hitl_reader_onay", session.kullaniciAdi);

  await db
    .update(schema.evraklar)
    .set({ durum: "taslak_hazirlaniyor", guncellemeZamani: new Date() })
    .where(eq(schema.evraklar.id, evrakId));

  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, evrak.kurumId));
  const sablon = evrak.evrakTuru
    ? (await db.select().from(schema.yazismaSablonlari).where(eq(schema.yazismaSablonlari.evrakTuru, evrak.evrakTuru)))[0]
    : null;

  const mevzuatEslesmeleri: MevzuatEslesmesi[] = evrak.mevzuatEslesmeleri
    ? JSON.parse(evrak.mevzuatEslesmeleri)
    : [];

  const taslak = await taslakOlustur({
    kurumAdi: kurum?.ad ?? "Kurum",
    basvuruSahibi: evrak.basvuruSahibiAdSoyad,
    ozet: evrak.analizOzeti ?? "",
    dilekceMetni: evrak.rawText,
    mevzuatEslesmeleri,
    taslakKurallari: sablon?.taslakKurallari ?? "",
  });

  await db
    .update(schema.evraklar)
    .set({ taslakYapisi: JSON.stringify(taslak), durum: "onay_zincirinde", guncellemeZamani: new Date() })
    .where(eq(schema.evraklar.id, evrakId));

  await onayZinciriOlustur("evrak", evrakId, evrak.birimId);
  await auditYaz(evrakId, "taslak_olusturuldu", "sistem");

  revalidatePath("/panel");
  revalidatePath(`/panel/evrak/${evrakId}`);
}

/** HITL #1 alternative path — forward/refer the case to a different kurum/birim. */
export async function havaleEt(evrakId: string, formData: FormData) {
  const { session, evrak } = await evrakGetirVeYetkiKontrol(evrakId);
  if (evrak.durum !== "ic_incelemede") throw new Error("Bu evrak inceleme aşamasında değil.");

  const hedef = String(formData.get("_hedef") ?? "");
  const sebep = String(formData.get("sebep") ?? "");
  const [yeniKurumId, yeniBirimId] = hedef.split("|");
  if (!yeniKurumId || !yeniBirimId) throw new Error("Hedef birim seçilmedi.");

  await havaleKaydet({
    hedefTuru: "evrak",
    hedefId: evrakId,
    eskiKurumId: evrak.kurumId,
    eskiBirimId: evrak.birimId,
    yeniKurumId,
    yeniBirimId,
    sebep,
    yapanKullaniciId: session.userId,
  });

  await db
    .update(schema.evraklar)
    .set({ kurumId: yeniKurumId, birimId: yeniBirimId, durum: "ic_incelemede", guncellemeZamani: new Date() })
    .where(eq(schema.evraklar.id, evrakId));

  await auditYaz(evrakId, "havale", session.kullaniciAdi, { yeniKurumId, yeniBirimId, sebep });

  revalidatePath("/panel");
  revalidatePath(`/panel/evrak/${evrakId}`);
}

/**
 * Direct edit of the drafted response text — the clerk isn't limited to a
 * blind Approve/Reject on the AI's draft, they can rewrite it outright.
 * If the case had been sent back for correction (taslak_hazirlaniyor), an
 * edit here restarts the approval chain from the top since the text
 * approvers already signed off on has changed.
 */
export async function taslakGuncelle(evrakId: string, formData: FormData) {
  const { session, evrak } = await evrakGetirVeYetkiKontrol(evrakId);
  if (evrak.durum !== "onay_zincirinde" && evrak.durum !== "taslak_hazirlaniyor") {
    throw new Error("Taslak bu aşamada düzenlenemez.");
  }

  const mevcut = yanitTaslagiCoz(evrak.taslakYapisi);
  if (!mevcut) throw new Error("Düzenlenecek bir taslak bulunamadı.");

  const govdeMetni = String(formData.get("govde_metni") ?? mevcut.govdeMetni).trim();
  if (!govdeMetni) throw new Error("Yazının gövdesi boş olamaz.");

  const yeni: YanitTaslagi = {
    konu: String(formData.get("konu") ?? mevcut.konu).trim(),
    hitap: String(formData.get("hitap") ?? mevcut.hitap).trim(),
    govdeMetni,
  };

  const yenidenBaslatiliyor = evrak.durum === "taslak_hazirlaniyor";

  await db
    .update(schema.evraklar)
    .set({
      taslakYapisi: JSON.stringify(yeni),
      durum: "onay_zincirinde",
      guncellemeZamani: new Date(),
    })
    .where(eq(schema.evraklar.id, evrakId));

  if (yenidenBaslatiliyor) {
    await onayZinciriSifirla("evrak", evrakId);
  }

  await auditYaz(evrakId, "taslak_duzenlendi", session.kullaniciAdi);

  revalidatePath("/panel");
  revalidatePath(`/panel/evrak/${evrakId}`);
}

/** A hierarchy level's decision on the sequential approval chain. */
export async function onayAdimiKarar(
  evrakId: string,
  adimId: number,
  karar: "onaylandi" | "reddedildi" | "duzeltme_istendi",
  formData: FormData
) {
  const yorum = String(formData.get("yorum") ?? "");
  const { session, evrak } = await evrakGetirVeYetkiKontrol(evrakId);
  if (evrak.durum !== "onay_zincirinde") throw new Error("Bu evrak onay zincirinde değil.");

  const { sonAdimMi } = await adimKararVer({
    hedefTuru: "evrak",
    hedefId: evrakId,
    adimId,
    karar,
    yorum,
    kullaniciId: session.userId,
    hiyerarsiSeviyesi: session.hiyerarsiSeviyesi,
  });

  await auditYaz(evrakId, `onay_adimi_${karar}`, session.kullaniciAdi, { yorum });

  if (karar === "reddedildi" || karar === "duzeltme_istendi") {
    await db
      .update(schema.evraklar)
      .set({ durum: "taslak_hazirlaniyor", guncellemeZamani: new Date() })
      .where(eq(schema.evraklar.id, evrakId));
  } else if (sonAdimMi) {
    await db
      .update(schema.evraklar)
      .set({
        durum: "gonderildi",
        bildirimGonderildiMi: true,
        bildirimZamani: new Date(),
        guncellemeZamani: new Date(),
      })
      .where(eq(schema.evraklar.id, evrakId));
    await auditYaz(evrakId, "bildirim_gonderildi_simulasyon", "sistem");
  }

  revalidatePath("/panel");
  revalidatePath(`/panel/evrak/${evrakId}`);
}

/**
 * Asks the AI to revise the whole response letter body per a free-text
 * instruction. As with staff documents, the result waits as a suggestion —
 * an approver must never find that the text they signed off on changed
 * underneath them.
 */
export async function yaziOnerisiIste(evrakId: string, formData: FormData) {
  const { session, evrak } = await evrakGetirVeYetkiKontrol(evrakId);
  const taslak = yanitTaslagiCoz(evrak.taslakYapisi);
  if (!taslak) throw new Error("Düzenlenecek bir taslak bulunamadı.");

  const oneri = await belgeOnerisiOlustur({
    belgeTuruAdi: "Vatandaşa gönderilecek resmi cevap yazısı",
    icerikRehberi:
      "İlgi satırı, talebin değerlendirmeye alındığı, yönlendirildiği birim/süreç ve " +
      "varsa dayanak mevzuat, vatandaşın bundan sonra ne bekleyeceği, kapanış cümlesi.",
    mevcutGovde: taslak.govdeMetni,
    baglam: `Başvuru sahibi: ${evrak.basvuruSahibiAdSoyad}. Başvuru özeti: ${evrak.analizOzeti ?? ""}`,
    talimat: String(formData.get("talimat") ?? "").trim(),
    kurumId: evrak.kurumId ?? "",
  });

  if (oneri) {
    await oneriEkle({
      hedefTuru: "evrak",
      hedefId: evrakId,
      oncekiMetin: taslak.govdeMetni,
      oneriMetin: oneri.govdeMetni,
      gerekce: oneri.gerekce,
      kaynak: "ai",
    });
    await auditYaz(evrakId, "yazi_ai_onerisi", session.kullaniciAdi);
  }

  revalidatePath(`/panel/evrak/${evrakId}`);
}

/** Applies or rejects a pending suggestion on the response letter. */
export async function yaziOneriKarar(
  evrakId: string,
  karar: "kabul" | "red",
  formData: FormData
) {
  const { session, evrak } = await evrakGetirVeYetkiKontrol(evrakId);
  const taslak = yanitTaslagiCoz(evrak.taslakYapisi);
  if (!taslak) throw new Error("Taslak bulunamadı.");

  const oneriId = Number(formData.get("oneri_id"));
  const oneri = await oneriGetir(oneriId);
  if (!oneri || oneri.hedefTuru !== "evrak" || oneri.hedefId !== evrakId) {
    throw new Error("Öneri bulunamadı.");
  }
  if (oneri.durum !== "bekliyor") throw new Error("Bu öneri zaten karara bağlanmış.");

  if (karar === "kabul") {
    if (taslak.govdeMetni !== oneri.oncekiMetin) {
      throw new Error("Yazı bu öneri hazırlandıktan sonra değişmiş — öneri uygulanamaz.");
    }
    const yeni: YanitTaslagi = { ...taslak, govdeMetni: oneri.oneriMetin };
    await db
      .update(schema.evraklar)
      .set({ taslakYapisi: JSON.stringify(yeni), guncellemeZamani: new Date() })
      .where(eq(schema.evraklar.id, evrakId));

    // Same "approver must never find the text they signed changed underneath
    // them" property taslakGuncelle enforces on a direct edit — applying an
    // AI suggestion changes the body exactly the same way, so it must reset
    // the chain too.
    if (evrak.durum === "onay_zincirinde") {
      await onayZinciriSifirla("evrak", evrakId);
    }
  }

  await oneriKararKaydet(oneriId, karar, session.userId);
  await auditYaz(evrakId, `yazi_oneri_${karar}`, session.kullaniciAdi, { oneriId });

  revalidatePath(`/panel/evrak/${evrakId}`);
}
