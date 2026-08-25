import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Approval-chain and routing mechanics shared by the citizen evrak response
 * flow and chat-authored belgeler — one workflow concept serving both
 * targets via onayAdimlari.hedefTuru/hedefId and havaleler.hedefTuru/hedefId
 * (the same polymorphic shape belgeOnerileri already used). The per-type
 * gating (which durum values allow which transition, what each type's
 * "done" state is called) stays in the two callers — panel/actions.ts for
 * evrak, panel/belge/actions.ts for belge — since those differ by type and
 * folding them in here would just move the branching, not remove it.
 */

export type OnayHedefTuru = "evrak" | "belge";

/** Creates the ordered approval chain for one target, from its birim's configured levels. */
export async function onayZinciriOlustur(
  hedefTuru: OnayHedefTuru,
  hedefId: string,
  birimId: string
): Promise<void> {
  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, birimId));
  const seviyeler: number[] = JSON.parse(birim?.onayZinciriSeviyeleri ?? "[2]");

  await db.insert(schema.onayAdimlari).values(
    seviyeler.map((seviye, i) => ({
      hedefTuru,
      hedefId,
      sira: i,
      gerekliHiyerarsiSeviyesi: seviye,
      durum: "bekliyor" as const,
    }))
  );
}

export async function onayAdimlariGetir(hedefTuru: OnayHedefTuru, hedefId: string) {
  return db
    .select()
    .from(schema.onayAdimlari)
    .where(and(eq(schema.onayAdimlari.hedefTuru, hedefTuru), eq(schema.onayAdimlari.hedefId, hedefId)))
    .orderBy(schema.onayAdimlari.sira);
}

/**
 * Sequential-gate + level-check: the step must exist and still be pending,
 * every earlier step must already be onaylandi, and the acting user's
 * hierarchy level must match what this step requires. Records the decision
 * and reports whether it was the chain's last step; the caller decides what
 * that means for its own target's durum.
 */
export async function adimKararVer(params: {
  hedefTuru: OnayHedefTuru;
  hedefId: string;
  adimId: number;
  karar: "onaylandi" | "reddedildi" | "duzeltme_istendi";
  yorum: string;
  kullaniciId: string;
  hiyerarsiSeviyesi: number;
}): Promise<{ sonAdimMi: boolean }> {
  const adimlar = await onayAdimlariGetir(params.hedefTuru, params.hedefId);
  const adim = adimlar.find((a) => a.id === params.adimId);
  if (!adim) throw new Error("Onay adımı bulunamadı.");
  if (adim.durum !== "bekliyor") throw new Error("Bu adım zaten karara bağlanmış.");

  const oncekiAdimlarTamam = adimlar
    .filter((a) => a.sira < adim.sira)
    .every((a) => a.durum === "onaylandi");
  if (!oncekiAdimlarTamam) {
    throw new Error("Önceki onay adımları tamamlanmadan bu adıma karar verilemez.");
  }

  if (adim.gerekliHiyerarsiSeviyesi !== params.hiyerarsiSeviyesi) {
    throw new Error("Bu onay adımı sizin hiyerarşi seviyenize ait değil.");
  }

  await db
    .update(schema.onayAdimlari)
    .set({
      durum: params.karar,
      onaylayanKullaniciId: params.kullaniciId,
      yorum: params.yorum,
      zaman: new Date(),
    })
    .where(eq(schema.onayAdimlari.id, params.adimId));

  const sonAdimMi = adim.sira === Math.max(...adimlar.map((a) => a.sira));
  return { sonAdimMi };
}

/**
 * Resets every step of an existing chain back to bekliyor — the shared
 * "approvers must never find the text they signed changed underneath them"
 * guard. Callers decide *when* this applies (mid-chain direct edit,
 * restarting from a rejection, an AI suggestion just applied); this just
 * does the reset once that decision is made.
 */
export async function onayZinciriSifirla(hedefTuru: OnayHedefTuru, hedefId: string): Promise<void> {
  await db
    .update(schema.onayAdimlari)
    .set({ durum: "bekliyor", onaylayanKullaniciId: null, yorum: null, zaman: null })
    .where(and(eq(schema.onayAdimlari.hedefTuru, hedefTuru), eq(schema.onayAdimlari.hedefId, hedefId)));
}

/** The append-only forwarding-record insert shared by havaleEt and belgeHavaleEt. */
export async function havaleKaydet(params: {
  hedefTuru: OnayHedefTuru;
  hedefId: string;
  eskiKurumId: string | null;
  eskiBirimId: string | null;
  yeniKurumId: string;
  yeniBirimId: string;
  sebep: string;
  yapanKullaniciId: string;
}): Promise<void> {
  await db.insert(schema.havaleler).values(params);
}
