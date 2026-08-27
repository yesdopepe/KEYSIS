import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { siniflandirDilekce } from "@/lib/agents/router";
import { eksikBilgiTespitEt, type GerekliAlan } from "@/lib/agents/eksik-bilgi";
import { eksikYerTutucular, type EksikAlan } from "@/lib/basvuru/eksiklik";
import { evrakiOku } from "@/lib/agents/reader";
import { yeniKayitNo, yeniTakipNo } from "./kayit-no";

import { ekleriAnalizEt, type GirdiEkDosya } from "@/lib/agents/ek-analiz";

export interface BasvuruEkBilgisi {
  id: string;
  ad: string;
  dosyaAdi: string;
  mimeTur: string;
  boyut: number;
  diskYolu: string;
  rawText: string | null;
  tur: "belge" | "gorsel" | "pdf";
}

export type BasvuruSonucu =
  // `evrakTuruId` is absent when the petition is refused before classification
  // — an unfilled placeholder is visible without knowing the evrak türü.
  | { durum: "eksik_bilgi"; evrakTuruId?: string; eksikAlanlar: EksikAlan[] }
  | { durum: "tamamlandi"; takipNo: string; evrakId: string };

/**
 * Shortest text that can carry a request, once placeholder markers are
 * discounted. Set low on purpose: petitioning is a right under 3071, so this
 * only catches an empty or failed draft, never a terse but real complaint.
 */
const ASGARI_METIN = 40;

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
 * Reader agent, analyzes attachments, and creates the evrak row in `ic_incelemede`, ready for a
 * clerk.
 */
export async function basvuruIsle(params: {
  dilekceMetni: string;
  basvuruSahibiAdSoyad: string;
  basvuruSahibiIletisim: string;
  dosyaAdi?: string;
  ekler?: BasvuruEkBilgisi[];
}): Promise<BasvuruSonucu> {
  // Refuse before spending any model call: a petition still carrying the
  // drafting agent's "[EK BİLGİ GEREKLİ: …]" gaps is not a submission yet.
  // The client blocks the send button on the same rule, but this is the gate
  // that decides — the client's copy is only there to say so earlier.
  const yerTutucuEksikleri = eksikYerTutucular(params.dilekceMetni);
  if (yerTutucuEksikleri.length > 0) {
    return { durum: "eksik_bilgi", eksikAlanlar: yerTutucuEksikleri };
  }

  // The gaps that remain here are the ones the citizen cannot fill — the
  // drafting agent reporting that it found no legal basis, or that it could not
  // produce a document at all. Those are notes, not fields, so they pass the
  // check above; a text that is nothing *but* notes is still not a petition.
  if (params.dilekceMetni.replace(/\[[^\][]*\]/g, "").trim().length < ASGARI_METIN) {
    throw new Error(
      "Dilekçe metni başvuru için yeterli değil. Lütfen talebinizi kendi cümlelerinizle açıklayın."
    );
  }

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

  // Attachments analysis
  const ekDosyalar = params.ekler ?? [];
  let ekAnalizSonucu = null;
  if (ekDosyalar.length > 0) {
    const girdiDosyalar: GirdiEkDosya[] = ekDosyalar.map((e) => ({
      ad: e.ad,
      mimeTur: e.mimeTur,
      rawText: e.rawText,
      boyut: e.boyut,
    }));
    ekAnalizSonucu = await ekleriAnalizEt(params.dilekceMetni, girdiDosyalar);
  }

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
    dosyaAdi: params.dosyaAdi || (ekDosyalar.length > 0 ? ekDosyalar[0].ad : undefined),
    confidence: siniflandirma.confidence,
    eksikBilgiler: JSON.stringify([]),
    analizOzeti: okuma.ozet,
    onceligi: okuma.onceligi,
    mevzuatEslesmeleri: JSON.stringify(okuma.mevzuatEslesmeleri),
    ekAnalizi: ekAnalizSonucu ? JSON.stringify(ekAnalizSonucu) : null,
    durum: "ic_incelemede",
  });

  // Insert individual attachment records if any
  if (ekDosyalar.length > 0) {
    for (const ek of ekDosyalar) {
      const tekilAnaliz = ekAnalizSonucu?.dosyalar.find((d) => d.ad === ek.ad);
      await db.insert(schema.evrakEkleri).values({
        id: ek.id,
        evrakId,
        ad: ek.ad,
        dosyaAdi: ek.dosyaAdi,
        mimeTur: ek.mimeTur,
        boyut: ek.boyut,
        diskYolu: ek.diskYolu,
        rawText: ek.rawText,
        tur: ek.tur,
        analizOzeti: tekilAnaliz?.ozet ?? null,
        uygunlukDurumu: tekilAnaliz?.uygunlukDurumu ?? "uyumlu",
        uygunlukNotu: tekilAnaliz?.notlar ?? null,
      });
    }
  }

  await auditYaz(evrakId, "kayit_ve_siniflandirma", "sistem", {
    confidence: siniflandirma.confidence,
    aciklama: siniflandirma.aciklama,
    ekSayisi: ekDosyalar.length,
  });

  return { durum: "tamamlandi", takipNo, evrakId };
}

// onayZinciriOlustur moved to @/lib/onay — it's now shared with the belge
// approval flow (see src/lib/onay/index.ts), keyed by hedefTuru/hedefId
// rather than evrakId alone.
