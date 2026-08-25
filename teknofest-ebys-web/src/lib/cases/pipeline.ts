import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { siniflandirDilekce } from "@/lib/agents/router";
import { eksikBilgiTespitEt, type GerekliAlan } from "@/lib/agents/eksik-bilgi";
import { evrakiOku } from "@/lib/agents/reader";
import { yeniKayitNo, yeniTakipNo } from "./kayit-no";

export type BasvuruSonucu =
  | { durum: "eksik_bilgi"; evrakTuruId: string; eksikAlanlar: { alan: string; soru: string }[] }
  | { durum: "tamamlandi"; takipNo: string; evrakId: string };

async function sablonGetir(evrakTuruId: string) {
  const [sablon] = await db
    .select()
    .from(schema.yazismaSablonlari)
    .where(eq(schema.yazismaSablonlari.id, evrakTuruId));
  return sablon;
}

async function auditYaz(evrakId: string | null, islem: string, kullanici: string, detay: object = {}) {
  await db.insert(schema.auditLog).values({
    evrakId,
    islem,
    kullanici,
    detay: JSON.stringify(detay),
  });
}

/**
 * Citizen submission entrypoint. Classifies the dilekçe, checks it against
 * the matched şablon's required fields, and either asks for what's missing
 * (same-session, no persistence yet) or finalizes the case: runs the
 * Reader agent and creates the evrak row in `ic_incelemede`, ready for a
 * clerk.
 */
export async function basvuruIsle(params: {
  dilekceMetni: string;
  basvuruSahibiAdSoyad: string;
  basvuruSahibiIletisim: string;
  dosyaAdi?: string;
}): Promise<BasvuruSonucu> {
  const siniflandirma = await siniflandirDilekce(params.dilekceMetni);
  const sablon = await sablonGetir(siniflandirma.evrakTuruId);
  if (!sablon) {
    throw new Error(`Şablon bulunamadı: ${siniflandirma.evrakTuruId}`);
  }

  const gerekliAlanlar: GerekliAlan[] = JSON.parse(sablon.gerekliAlanlar);
  const eksikAlanlar = await eksikBilgiTespitEt(params.dilekceMetni, gerekliAlanlar);

  if (eksikAlanlar.length > 0) {
    return { durum: "eksik_bilgi", evrakTuruId: siniflandirma.evrakTuruId, eksikAlanlar };
  }

  const okuma = await evrakiOku(params.dilekceMetni, siniflandirma.evrakTuru, siniflandirma.kurumId);

  const kayitNo = await yeniKayitNo(siniflandirma.kurumId, siniflandirma.sdpKodu);
  const takipNo = yeniTakipNo();
  const evrakId = randomUUID();

  await db.insert(schema.evraklar).values({
    id: evrakId,
    takipNo,
    kayitNo,
    kurumId: siniflandirma.kurumId,
    birimId: siniflandirma.birimId,
    evrakTuru: siniflandirma.evrakTuru,
    sdpKodu: siniflandirma.sdpKodu,
    basvuruSahibiAdSoyad: params.basvuruSahibiAdSoyad,
    basvuruSahibiIletisim: params.basvuruSahibiIletisim,
    rawText: params.dilekceMetni,
    dosyaAdi: params.dosyaAdi,
    confidence: siniflandirma.confidence,
    eksikBilgiler: JSON.stringify([]),
    analizOzeti: okuma.ozet,
    onceligi: okuma.onceligi,
    mevzuatEslesmeleri: JSON.stringify(okuma.mevzuatEslesmeleri),
    durum: "ic_incelemede",
  });

  await auditYaz(evrakId, "kayit_ve_siniflandirma", "sistem", {
    confidence: siniflandirma.confidence,
    aciklama: siniflandirma.aciklama,
  });

  return { durum: "tamamlandi", takipNo, evrakId };
}

// onayZinciriOlustur moved to @/lib/onay — it's now shared with the belge
// approval flow (see src/lib/onay/index.ts), keyed by hedefTuru/hedefId
// rather than evrakId alone.
