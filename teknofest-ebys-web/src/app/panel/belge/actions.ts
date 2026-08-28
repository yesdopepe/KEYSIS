"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { belgeTuruGetir } from "@/lib/belgeler/turler";
import { belgeyiOkuyabilirMi, vatandasBelgesiMi } from "@/lib/belgeler/erisim";
import { belgedenModel } from "@/lib/belgeler/modelle";
import { belgeOnerisiOlustur, type BelgeKaynagi } from "@/lib/agents/belge-yazar";
import { oneriEkle, oneriGetir, oneriKararKaydet, bekleyenOnerileriGetir } from "@/lib/belgeler/oneriler";
import { onayZinciriOlustur, onayZinciriSifirla, adimKararVer, havaleKaydet, onayAdimlariGetir } from "@/lib/onay";
import { tumKurumVeBirimler } from "@/lib/cases/queries";
import { durumBilgisiGetir } from "@/lib/ui/durum";
import type { BelgeCalismaAlaniProps } from "@/components/belge/BelgeCalismaAlani";
import type { YanitTaslagi } from "@/lib/belgeler/yanit-taslagi";

// Document creation (belgeOlusturAction) moved into the chat assistant's
// belgeTaslagiHazirla tool (src/app/api/asistan/route.ts) — the agent is now
// the only way to create a belge, per the same reasoning as every other
import { getSession } from "@/lib/auth/session";

async function auditYaz(kullanici: string, islem: string, detay: object = {}) {
  await db.insert(schema.auditLog).values({ islem, kullanici, detay: JSON.stringify(detay) });
}

async function belgeYetkiKontrol(belgeId: string, birimId: string, userId?: string) {
  const [belge] = await db.select().from(schema.belgeler).where(eq(schema.belgeler.id, belgeId));
  if (!belge) reddet("Belge bulunamadı.");
  const vatandasaAit = vatandasBelgesiMi(belge);
  if (belge.birimId !== birimId && !vatandasaAit) reddet("Bu belge sizin biriminize ait değil.");
  return belge;
}

/**
 * What a workflow action reports back to its form.
 *
 * These actions used to throw for *expected* refusals ("this belge is not
 * finished yet", "resolve the pending suggestions first"). A bare
 * `<form action={...}>` has nowhere to put a thrown error, and a production
 * build strips the message to a digest and answers 500 — so every refusal and
 * every genuine bug looked identical from the browser. Refusals now come back
 * as data the form can render; only the unexpected still throws, and that
 * throw is logged first so the digest has a matching server line.
 */
export type IsAkisiSonucu = { basarili: true } | { basarili: false; hata: string };

class IsAkisiReddi extends Error {}

/** Marks a refusal the user is meant to read, as opposed to a defect. */
function reddet(mesaj: string): never {
  throw new IsAkisiReddi(mesaj);
}

/**
 * Runs a workflow action and converts its outcome into IsAkisiSonucu.
 * A refusal becomes `{ basarili: false }`; anything else is logged with enough
 * context to identify the row involved, then rethrown so the error boundary
 * shows a digest that can be matched to that log line.
 */
async function isAkisiniYurut(
  etiket: string,
  baglam: Record<string, unknown>,
  islem: () => Promise<void>
): Promise<IsAkisiSonucu> {
  try {
    await islem();
    return { basarili: true };
  } catch (err) {
    if (err instanceof IsAkisiReddi) return { basarili: false, hata: err.message };
    // redirect() and notFound() throw control-flow signals that must pass through.
    if (err && typeof err === "object" && "digest" in err) throw err;
    console.error(`${etiket} başarısız:`, { ...baglam, hata: err });
    throw err;
  }
}

/** Saves edits to the document body — this is the "report editing" surface. */
export async function belgeGuncelle(belgeId: string, formData: FormData) {
  const session = (await getSession()) || {
    userId: "u_vatandas",
    kullaniciAdi: "vatandas",
    adSoyad: "Vatandaş",
    kurumId: "belediye_ornek",
    birimId: "belediye_ornek:YZI",
    hiyerarsiSeviyesi: 0,
    unvan: "Vatandaş",
    sistemYoneticisiMi: false,
    mevzuatYonetimi: false,
    bilgiTabaniYonetimi: false,
  };
  const belge = await belgeYetkiKontrol(belgeId, session.birimId, session.userId);

  // Finished — editing an approved document outright would let its text
  // diverge from what every approver actually signed off on.
  if (belge.durum === "onaylandi") {
    throw new Error("Onaylanmış bir belge doğrudan düzenlenemez.");
  }

  const govdeMetni = String(formData.get("govde_metni") ?? belge.govdeMetni);
  const baslikRaw = formData.get("baslik");
  const baslik = baslikRaw !== null && baslikRaw !== undefined ? String(baslikRaw).trim() : belge.baslik;
  const tamamla = formData.get("_tamamla") === "1";

  // Same reasoning as taslakGuncelle for evrak: an edit mid-approval-chain
  // must never leave an approver's earlier "onaylandı" standing against text
  // they never actually saw — reset every step back to bekliyor instead.
  const zincirSifirlaniyor = belge.durum === "onay_zincirinde";

  await db
    .update(schema.belgeler)
    .set({
      govdeMetni,
      baslik: baslik || belge.baslik,
      durum: tamamla ? "tamamlandi" : belge.durum,
      guncellemeZamani: new Date(),
    })
    .where(eq(schema.belgeler.id, belgeId));

  if (zincirSifirlaniyor) {
    await onayZinciriSifirla("belge", belgeId);
  }

  await auditYaz(session.kullaniciAdi, tamamla ? "belge_tamamlandi" : "belge_duzenlendi", { belgeId, baslik });

  revalidatePath(`/panel/belge/${belgeId}`);
  revalidatePath("/panel/belge");
}

export async function belgeMetniKaydet(
  belgeId: string,
  params: { govdeMetni: string; baslik?: string } | string
) {
  const formData = new FormData();
  if (typeof params === "string") {
    formData.set("govde_metni", params);
  } else {
    formData.set("govde_metni", params.govdeMetni);
    if (params.baslik) formData.set("baslik", params.baslik);
  }
  await belgeGuncelle(belgeId, formData);
}

/**
 * Which birim's approval chain a document enters.
 *
 * belgeYetkiKontrol deliberately lets any staff member act on a dilekçe
 * whichever birim owns it (see vatandasBelgesiMi) — that is what lets a memur
 * pick up a citizen's petition. But the chain used to be built from the
 * *document's* birim, while /panel lists pending approvals with
 * `eq(belgeler.birimId, session.birimId)` (lib/cases/queries.ts). A MEB memur
 * sending a citizen dilekçe upward therefore created a chain inside the
 * belediye's birim, where no MEB müdür would ever see it: the document went
 * "up" and disappeared. Taking it over is a move between birimler, so record it
 * as the havale it actually is rather than editing the row silently.
 */
async function onayIcinBirimeAl(
  belge: typeof schema.belgeler.$inferSelect,
  session: { userId: string; kullaniciAdi: string; kurumId: string; birimId: string }
): Promise<string> {
  if (belge.birimId === session.birimId) return belge.birimId;

  await havaleKaydet({
    hedefTuru: "belge",
    hedefId: belge.id,
    eskiKurumId: belge.kurumId,
    eskiBirimId: belge.birimId,
    yeniKurumId: session.kurumId,
    yeniBirimId: session.birimId,
    sebep: "Onaya gönderen personelin birimine devralındı.",
    yapanKullaniciId: session.userId,
  });

  await db
    .update(schema.belgeler)
    .set({ kurumId: session.kurumId, birimId: session.birimId, guncellemeZamani: new Date() })
    .where(eq(schema.belgeler.id, belge.id));

  await auditYaz(session.kullaniciAdi, "belge_onay_oncesi_devralindi", {
    belgeId: belge.id,
    eskiBirimId: belge.birimId,
    yeniBirimId: session.birimId,
  });

  return session.birimId;
}

/**
 * Sends a completed belge into its birim's approval chain — mirrors
 * hitlOnayla's evrak equivalent. Creates only bekliyor steps; nothing here
 * can write onaylandi, which stays exclusively belgeOnayAdimiKarar's job.
 */
export async function belgeyiOnayaGonder(belgeId: string): Promise<IsAkisiSonucu> {
  const session = await oturumZorunluKil();

  return isAkisiniYurut("belgeyiOnayaGonder", { belgeId, kullanici: session.kullaniciAdi }, async () => {
    const belge = await belgeYetkiKontrol(belgeId, session.birimId);

    // The button lives on a plain form with no pending state, so a double
    // submit lands here twice. The second one has already done its job.
    if (belge.durum === "onay_zincirinde") return;

    if (belge.durum !== "tamamlandi") {
      reddet("Yalnızca tamamlanmış bir belge onaya gönderilebilir.");
    }

    const bekleyenOneriler = await db
      .select({ id: schema.belgeOnerileri.id })
      .from(schema.belgeOnerileri)
      .where(
        and(
          eq(schema.belgeOnerileri.hedefTuru, "belge"),
          eq(schema.belgeOnerileri.hedefId, belgeId),
          eq(schema.belgeOnerileri.durum, "bekliyor")
        )
      );
    if (bekleyenOneriler.length > 0) {
      reddet("Onaya göndermeden önce bekleyen AI önerilerini kabul edin veya reddedin.");
    }

    const zincirBirimId = await onayIcinBirimeAl(belge, session);

    await db
      .update(schema.belgeler)
      .set({ durum: "onay_zincirinde", guncellemeZamani: new Date() })
      .where(eq(schema.belgeler.id, belgeId));

    await onayZinciriOlustur("belge", belgeId, zincirBirimId);
    await auditYaz(session.kullaniciAdi, "belge_onaya_gonderildi", { belgeId, birimId: zincirBirimId });

    revalidatePath(`/panel/belge/${belgeId}`);
    revalidatePath("/panel/belge");
    revalidatePath("/panel");
  });
}

/** A hierarchy level's decision on a belge's sequential approval chain. */
export async function belgeOnayAdimiKarar(
  belgeId: string,
  adimId: number,
  karar: "onaylandi" | "reddedildi" | "duzeltme_istendi",
  formData: FormData
): Promise<IsAkisiSonucu> {
  const yorum = String(formData.get("yorum") ?? "");
  const session = await oturumZorunluKil();

  return isAkisiniYurut(
    "belgeOnayAdimiKarar",
    { belgeId, adimId, karar, kullanici: session.kullaniciAdi },
    async () => {
      const belge = await belgeYetkiKontrol(belgeId, session.birimId);
      if (belge.durum !== "onay_zincirinde") reddet("Bu belge onay zincirinde değil.");

      // adimKararVer enforces the sequential gate and the level match; each of
      // its refusals is something the approver should read, not a 500.
      let sonAdimMi: boolean;
      try {
        ({ sonAdimMi } = await adimKararVer({
          hedefTuru: "belge",
          hedefId: belgeId,
          adimId,
          karar,
          yorum,
          kullaniciId: session.userId,
          hiyerarsiSeviyesi: session.hiyerarsiSeviyesi,
        }));
      } catch (err) {
        reddet(err instanceof Error ? err.message : "Onay adımı işlenemedi.");
      }

      await auditYaz(session.kullaniciAdi, `belge_onay_adimi_${karar}`, { belgeId, yorum });

      if (karar === "reddedildi" || karar === "duzeltme_istendi") {
        await db
          .update(schema.belgeler)
          .set({ durum: "taslak", guncellemeZamani: new Date() })
          .where(eq(schema.belgeler.id, belgeId));
      } else if (sonAdimMi) {
        await db
          .update(schema.belgeler)
          .set({ durum: "onaylandi", guncellemeZamani: new Date() })
          .where(eq(schema.belgeler.id, belgeId));
      }

      revalidatePath(`/panel/belge/${belgeId}`);
      revalidatePath("/panel/belge");
      revalidatePath("/panel");
    }
  );
}

/**
 * Reassigns a belge to a different institution/department while it's still
 * a draft — the belge-side counterpart of havaleEt. Only available before
 * Onaya Gönder: once a chain exists the belge belongs to this birim's
 * approval process, and rerouting it would orphan those steps.
 */
export async function belgeHavaleEt(belgeId: string, formData: FormData): Promise<IsAkisiSonucu> {
  const session = await oturumZorunluKil();
  const hedef = String(formData.get("_hedef") ?? "");
  const sebep = String(formData.get("sebep") ?? "");

  return isAkisiniYurut("belgeHavaleEt", { belgeId, hedef, kullanici: session.kullaniciAdi }, async () => {
    const belge = await belgeYetkiKontrol(belgeId, session.birimId);
    if (belge.durum !== "taslak" && belge.durum !== "tamamlandi") {
      reddet("Bu belge yalnızca onaya gönderilmeden önce havale edilebilir.");
    }

    const [yeniKurumId, yeniBirimId] = hedef.split("|");
    if (!yeniKurumId || !yeniBirimId) reddet("Hedef birim seçilmedi.");

    await havaleKaydet({
      hedefTuru: "belge",
      hedefId: belgeId,
      eskiKurumId: belge.kurumId,
      eskiBirimId: belge.birimId,
      yeniKurumId,
      yeniBirimId,
      sebep,
      yapanKullaniciId: session.userId,
    });

    await db
      .update(schema.belgeler)
      .set({ kurumId: yeniKurumId, birimId: yeniBirimId, guncellemeZamani: new Date() })
      .where(eq(schema.belgeler.id, belgeId));

    await auditYaz(session.kullaniciAdi, "belge_havale", { belgeId, yeniKurumId, yeniBirimId, sebep });

    revalidatePath(`/panel/belge/${belgeId}`);
    revalidatePath("/panel/belge");
    revalidatePath("/panel");
  });
}

/**
 * Copies a finished belge's text into an evrak's response letter — the
 * "use this document as the reply" action. Copies rather than repoints
 * evraklar.taslakYapisi at a foreign key: evraktanModel, taslakGuncelle,
 * yaziOnerisiIste, yaziOneriKarar and the evrak export route all read
 * taslakYapisi as an independent JSON blob today, and repointing every one
 * of them at a live belgeler join is a much wider change for no real gain —
 * yanitBelgeId already keeps the provenance link ("this reply came from
 * that belge") without entangling the two records' further edits.
 */
export async function belgeyiEvrakaYanitYap(belgeId: string, evrakId: string) {
  const session = await oturumZorunluKil();
  const belge = await belgeYetkiKontrol(belgeId, session.birimId);
  if (belge.durum !== "tamamlandi" && belge.durum !== "onaylandi") {
    throw new Error("Yalnızca tamamlanmış veya onaylanmış bir belge bir evraka yanıt olarak bağlanabilir.");
  }

  const [evrak] = await db.select().from(schema.evraklar).where(eq(schema.evraklar.id, evrakId));
  if (!evrak) throw new Error("Evrak bulunamadı.");
  if (evrak.birimId !== session.birimId) throw new Error("Bu evrak sizin biriminize ait değil.");
  if (evrak.durum !== "ic_incelemede" && evrak.durum !== "taslak_hazirlaniyor") {
    throw new Error("Bu evrak onay zincirine girdikten sonra yeni bir yanıt bağlanamaz.");
  }

  const taslak: YanitTaslagi = {
    konu: belge.baslik,
    hitap: `Sayın ${evrak.basvuruSahibiAdSoyad}`,
    govdeMetni: belge.govdeMetni,
  };

  await db
    .update(schema.evraklar)
    .set({
      yanitBelgeId: belgeId,
      taslakYapisi: JSON.stringify(taslak),
      durum: "onay_zincirinde",
      guncellemeZamani: new Date(),
    })
    .where(eq(schema.evraklar.id, evrakId));

  if (evrak.birimId) {
    await onayZinciriOlustur("evrak", evrakId, evrak.birimId);
  }

  await auditYaz(session.kullaniciAdi, "belge_evraka_yanit_yapildi", { belgeId, evrakId });
  await db.insert(schema.auditLog).values({
    evrakId,
    islem: "evrak_yaniti_belgeden_uretildi",
    kullanici: session.kullaniciAdi,
    detay: JSON.stringify({ belgeId }),
  });

  revalidatePath(`/panel/belge/${belgeId}`);
  revalidatePath(`/panel/evrak/${evrakId}`);
  revalidatePath("/panel");
}

/**
 * Candidate evraks a belge could become the response for — this birim's
 * open cases, newest first. Read-only; linking itself is the Server Action
 * above; a chat tool listing candidates must not be able to link them too,
 * since only a human confirming which evrak matches should do that.
 */
export async function evrakYanitAdaylariGetir(birimId: string) {
  return db
    .select({
      id: schema.evraklar.id,
      takipNo: schema.evraklar.takipNo,
      kayitNo: schema.evraklar.kayitNo,
      basvuruSahibiAdSoyad: schema.evraklar.basvuruSahibiAdSoyad,
      analizOzeti: schema.evraklar.analizOzeti,
      durum: schema.evraklar.durum,
    })
    .from(schema.evraklar)
    .where(
      and(eq(schema.evraklar.birimId, birimId), inArray(schema.evraklar.durum, ["ic_incelemede", "taslak_hazirlaniyor"]))
    )
    .orderBy(desc(schema.evraklar.olusturmaZamani))
    .limit(10);
}

/**
 * Asks the AI to revise the whole document body per a free-text instruction.
 * The result is stored as a pending suggestion rather than written into the
 * document — no AI edit reaches a document without a person accepting it.
 * Called from the chat's belgeRevizyonuOner tool (src/app/api/asistan/route.ts);
 * plain args rather than FormData since it's no longer bound to an HTML form —
 * the canvas has no "ask AI to revise" button of its own, only the chat does.
 */
export async function belgeRevizyonuOner(params: {
  belgeId: string;
  talimat: string;
  kullaniciAdi: string;
  /**
   * The caller's own birim, already resolved from its session — passed as
   * data rather than re-deriving via oturumZorunluKil() so a Route Handler
   * caller (which already has a session) isn't forced into a second cookie
   * lookup. The ownership check itself still happens in here, not left to
   * the caller to remember, the same defense-in-depth every other function
   * in this file applies.
   */
  birimId: string;
}): Promise<{ basarili: boolean; gerekce?: string; hata?: string }> {
  const belge = await db.select().from(schema.belgeler).where(eq(schema.belgeler.id, params.belgeId)).then((r) => r[0]);
  if (!belge) return { basarili: false, hata: "Belge bulunamadı." };
  const vatandasaAit =
    (belge.olusturanKullaniciId === "u_vatandas" || belge.belgeTuru === "dilekce") &&
    params.kullaniciAdi === "vatandas";
  if (belge.birimId !== params.birimId && !vatandasaAit) return { basarili: false, hata: "Bu belge sizin biriminize ait değil." };
  if (belge.durum === "onaylandi") {
    return { basarili: false, hata: "Onaylanmış bir belge için revizyon önerilemez." };
  }

  const tur = belgeTuruGetir(belge.belgeTuru);
  const oneri = await belgeOnerisiOlustur({
    belgeTuruAdi: tur?.ad ?? belge.belgeTuru,
    icerikRehberi: tur?.icerikRehberi ?? "",
    mevcutGovde: belge.govdeMetni,
    baglam: belge.baglam,
    talimat: params.talimat,
    kurumId: belge.kurumId,
  });

  if (!oneri) {
    return { basarili: false, hata: "Bir öneri üretilemedi veya mevcut metinden farklı bir sonuç çıkmadı." };
  }

  await oneriEkle({
    hedefTuru: "belge",
    hedefId: params.belgeId,
    oncekiMetin: belge.govdeMetni,
    oneriMetin: oneri.govdeMetni,
    gerekce: oneri.gerekce,
    kaynak: "ai",
  });
  await auditYaz(params.kullaniciAdi, "belge_ai_onerisi", { belgeId: params.belgeId });

  revalidatePath(`/panel/belge/${params.belgeId}`);
  revalidatePath(`/panel/asistan`);
  revalidatePath(`/basvuru/asistan`);

  return { basarili: true, gerekce: oneri.gerekce };
}

/** Applies an accepted suggestion to the document, or records a rejection. */
export async function belgeOneriKarar(
  belgeId: string,
  karar: "kabul" | "red",
  formData: FormData
) {
  const session = (await getSession()) || {
    userId: "u_vatandas",
    kullaniciAdi: "vatandas",
    adSoyad: "Vatandaş",
    kurumId: "belediye_ornek",
    birimId: "belediye_ornek:YZI",
    hiyerarsiSeviyesi: 0,
    unvan: "Vatandaş",
    sistemYoneticisiMi: false,
    mevzuatYonetimi: false,
    bilgiTabaniYonetimi: false,
  };
  const belge = await belgeYetkiKontrol(belgeId, session.birimId, session.userId);

  const oneriId = Number(formData.get("oneri_id"));
  const oneri = await oneriGetir(oneriId);
  if (!oneri || oneri.hedefTuru !== "belge" || oneri.hedefId !== belgeId) {
    throw new Error("Öneri bulunamadı.");
  }
  if (oneri.durum !== "bekliyor") throw new Error("Bu öneri zaten karara bağlanmış.");

  if (karar === "kabul") {
    // The document may have been edited after the suggestion was drafted;
    // applying blindly would silently discard that newer edit.
    if (belge.govdeMetni !== oneri.oncekiMetin) {
      throw new Error("Belge bu öneri hazırlandıktan sonra değişmiş — öneri uygulanamaz.");
    }
    await db
      .update(schema.belgeler)
      .set({ govdeMetni: oneri.oneriMetin, guncellemeZamani: new Date() })
      .where(eq(schema.belgeler.id, belgeId));

    // Same guard belgeGuncelle applies to a direct edit — accepting a
    // suggestion changes govdeMetni exactly the same way, so a chain in
    // progress must reset too, not just a hand-typed edit.
    if (belge.durum === "onay_zincirinde") {
      await onayZinciriSifirla("belge", belgeId);
    }
  }

  await oneriKararKaydet(oneriId, karar, session.userId);
  await auditYaz(session.kullaniciAdi, `belge_oneri_${karar}`, { belgeId, oneriId });

  revalidatePath(`/panel/belge/${belgeId}`);
  revalidatePath(`/basvuru/asistan`);
}

/**
 * Fetches the complete payload required to render BelgeCalismaAlani on the client.
 */
export async function belgeDetayGetirAction(belgeId: string): Promise<BelgeCalismaAlaniProps | null> {
  const session = (await getSession()) || {
    userId: "u_vatandas",
    kullaniciAdi: "vatandas",
    adSoyad: "Vatandaş",
    kurumId: "belediye_ornek",
    birimId: "belediye_ornek:YZI",
    hiyerarsiSeviyesi: 0,
    unvan: "Vatandaş",
    sistemYoneticisiMi: false,
    mevzuatYonetimi: false,
    bilgiTabaniYonetimi: false,
  };
  const [belge] = await db.select().from(schema.belgeler).where(eq(schema.belgeler.id, belgeId));
  if (!belge) return null;

  // This is the canvas's real read path (BelgeTuvaliIstemci calls it for
  // every ?belge=), and a Server Action is directly invocable — so the same
  // check the page does has to hold here too, not only in the page. Without
  // it, an id alone returned another institution's full document body.
  if (!belgeyiOkuyabilirMi(belge, session)) return null;

  const yetkili =
    belge.birimId === session.birimId ||
    vatandasBelgesiMi(belge);
  const tur = belgeTuruGetir(belge.belgeTuru);
  const kaynaklar: BelgeKaynagi[] = JSON.parse(belge.kaynaklar || "[]");
  const durum = durumBilgisiGetir(belge.durum);

  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, belge.kurumId));
  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, belge.birimId));
  const [yazar] = await db
    .select()
    .from(schema.kullanicilar)
    .where(eq(schema.kullanicilar.id, belge.olusturanKullaniciId));

  const model = belgedenModel(belge, kurum?.ad ?? "Kurum", birim?.ad, {
    adSoyad: yazar?.adSoyad ?? "",
    unvan: yazar?.unvan ?? "",
  });

  const [oneriler, onayAdimlari] = await Promise.all([
    bekleyenOnerileriGetir("belge", belge.id),
    belge.durum === "onay_zincirinde" ? onayAdimlariGetir("belge", belge.id) : Promise.resolve([]),
  ]);

  const siradakiAdim = onayAdimlari.find((a) => a.durum === "bekliyor");
  const oncekiTamam = siradakiAdim
    ? onayAdimlari.filter((a) => a.sira < siradakiAdim.sira).every((a) => a.durum === "onaylandi")
    : false;
  const benimSiram =
    yetkili && siradakiAdim && oncekiTamam && siradakiAdim.gerekliHiyerarsiSeviyesi === session.hiyerarsiSeviyesi;

  const { birimler } =
    belge.durum === "taslak" || belge.durum === "tamamlandi"
      ? await tumKurumVeBirimler()
      : { birimler: [] };
  const digerBirimler = birimler.filter((b) => b.id !== belge.birimId);

  const evrakAdaylari =
    yetkili && (belge.durum === "tamamlandi" || belge.durum === "onaylandi")
      ? await evrakYanitAdaylariGetir(belge.birimId)
      : [];

  return {
    belge: {
      id: belge.id,
      baslik: belge.baslik,
      belgeTuru: belge.belgeTuru,
      govdeMetni: belge.govdeMetni,
      durum: belge.durum,
      tarih: belge.olusturmaZamani ? new Date(belge.olusturmaZamani).toLocaleDateString("tr-TR") : undefined,
    },
    model,
    turAdi: tur?.ad ?? belge.belgeTuru,
    durum,
    kaynaklar,
    oneriler,
    onayAdimlari,
    yetkili,
    benimSiram: Boolean(benimSiram),
    siradakiAdimId: siradakiAdim?.id,
    digerBirimler: digerBirimler.map((b) => ({ id: b.id, ad: b.ad, kurumId: b.kurumId })),
    evrakAdaylari: evrakAdaylari.map((e) => ({
      id: e.id,
      takipNo: e.takipNo,
      kayitNo: e.kayitNo,
      basvuruSahibiAdSoyad: e.basvuruSahibiAdSoyad,
    })),
  };
}

