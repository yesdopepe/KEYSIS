"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { basvuruIsle, type BasvuruSonucu } from "@/lib/cases/pipeline";
import { evraktanModel } from "@/lib/belgeler/modelle";
import type { ResmiBelge } from "@/lib/belgeler/resmi-belge";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dosyadanMetinCikar } from "@/lib/docling";
import type { BasvuruEkBilgisi } from "@/lib/cases/pipeline";
import { belgeTuruGetir } from "@/lib/belgeler/turler";
import { belgeTaslagiOlusturAkisli } from "@/lib/agents/belge-yazar";
import { yerTutuculariDoldur } from "@/lib/basvuru/eksiklik";

const VERI_DIZINI = "./data";

export async function aiDilekceOlusturAction(ozetKonu: string): Promise<string> {
  if (!ozetKonu.trim()) {
    throw new Error("Lütfen talebinizi kısaca açıklayın.");
  }
  const tur = belgeTuruGetir("dilekce");
  if (!tur) throw new Error("Dilekçe türü tanımlı değil.");

  // No addressee and no mevzuat scope on purpose. This form has no
  // conversation behind it — only a one-line summary — so nothing here knows
  // which institution is competent, and the previous hardcoded
  // "Belediye Başkanlığı" put a municipality on the letterhead of every
  // petition regardless of subject. İLGİLİ MAKAMA is honest about that, and
  // the citizen edits it on the canvas.
  const sonuc = await belgeTaslagiOlusturAkisli({
    tur,
    baglam: ozetKonu,
    kurumId: null,
  });
  return sonuc.govdeMetni;
}

async function metinCikarGuvenli(dosya: File): Promise<string> {
  if (
    dosya.type.startsWith("text/") ||
    dosya.name.endsWith(".txt") ||
    dosya.name.endsWith(".md") ||
    dosya.name.endsWith(".csv") ||
    dosya.name.endsWith(".json")
  ) {
    try {
      return await dosya.text();
    } catch {
      // ignore
    }
  }
  try {
    return await dosyadanMetinCikar(dosya);
  } catch (err) {
    console.warn("Docling metin çıkarma hatası (fallback devrede):", err);
    return `[Ek Dosya: ${dosya.name}, Boyut: ${(dosya.size / 1024).toFixed(1)} KB]`;
  }
}

export type BasvuruFormSonucu = BasvuruSonucu & { dilekceMetni: string };

/**
 * Single entry point for the citizen submission form. On the first call,
 * `ekCevaplar` is empty; if the pipeline reports missing fields, the client
 * shows inline follow-up inputs and calls this again with the same merged
 * text plus the new answers appended — same session, no separate visit.
 */
export async function basvuruGonder(input: {
  dilekceMetni: string;
  ekCevaplar?: Record<string, string>;
  basvuruSahibiAdSoyad: string;
  basvuruSahibiIletisim: string;
  dosya?: File | null;
  dosyalar?: File[];
}): Promise<BasvuruFormSonucu> {
  let dilekceMetni = input.dilekceMetni;

  // Process attachments
  const gelenDosyalar: File[] = [];
  if (input.dosya && input.dosya.size > 0) {
    gelenDosyalar.push(input.dosya);
  }
  if (input.dosyalar && input.dosyalar.length > 0) {
    for (const d of input.dosyalar) {
      if (d.size > 0 && !gelenDosyalar.some((g) => g.name === d.name && g.size === d.size)) {
        gelenDosyalar.push(d);
      }
    }
  }

  const ekBilgileri: BasvuruEkBilgisi[] = [];

  for (const dosya of gelenDosyalar) {
    const ekId = randomUUID();
    const gorselMi = dosya.type.startsWith("image/");
    const pdfMi = dosya.type === "application/pdf" || dosya.name.endsWith(".pdf");
    const uzanti = path.extname(dosya.name);
    const goreliYol = path.join("evrak-ekleri", ekId, `${ekId}${uzanti}`);
    const tamYol = path.join(VERI_DIZINI, goreliYol);

    await mkdir(path.dirname(tamYol), { recursive: true });
    await writeFile(tamYol, Buffer.from(await dosya.arrayBuffer()));

    let rawText: string | null = null;
    if (!gorselMi) {
      rawText = await metinCikarGuvenli(dosya);
    }

    ekBilgileri.push({
      id: ekId,
      ad: dosya.name,
      dosyaAdi: `${ekId}${uzanti}`,
      mimeTur: dosya.type || "application/octet-stream",
      boyut: dosya.size,
      diskYolu: goreliYol,
      rawText,
      tur: gorselMi ? "gorsel" : pdfMi ? "pdf" : "belge",
    });
  }

  if (input.ekCevaplar && Object.keys(input.ekCevaplar).length > 0) {
    // Answers go back into the gaps they were asked for, so the petition reads
    // as one finished document. Only answers with nowhere to go are appended:
    // appending all of them left the "[EK BİLGİ GEREKLİ: …]" markers standing
    // in the body, and the pipeline would refuse the resubmission for exactly
    // the same gaps.
    const { metin, artanlar } = yerTutuculariDoldur(dilekceMetni, input.ekCevaplar);
    dilekceMetni = metin;

    const artanGirdiler = Object.entries(artanlar);
    if (artanGirdiler.length > 0) {
      const ekMetin = artanGirdiler.map(([alan, deger]) => `${alan}: ${deger}`).join("\n");
      dilekceMetni = `${dilekceMetni}\n\nEk Bilgiler:\n${ekMetin}`;
    }
  }

  if (!dilekceMetni.trim()) {
    throw new Error("Dilekçe metni boş olamaz.");
  }

  const sonuc = await basvuruIsle({
    dilekceMetni,
    basvuruSahibiAdSoyad: input.basvuruSahibiAdSoyad,
    basvuruSahibiIletisim: input.basvuruSahibiIletisim,
    dosyaAdi: ekBilgileri.length > 0 ? ekBilgileri[0].ad : undefined,
    ekler: ekBilgileri,
  });

  return { ...sonuc, dilekceMetni };
}

export interface BasvuruDurumu {
  takipNo: string;
  durum: string;
  evrakTuru: string | null;
  kurumAdi: string | null;
  olusturmaZamani: number | null;
  /** Rendered response letter — only present once the case has been sent. */
  belge: ResmiBelge | null;
  bildirimGonderildiMi: boolean;
}

export async function basvuruDurumSorgula(takipNo: string): Promise<BasvuruDurumu | null> {
  const [row] = await db
    .select({
      evrak: schema.evraklar,
      kurumAdi: schema.kurumlar.ad,
      birimAdi: schema.birimler.ad,
    })
    .from(schema.evraklar)
    .leftJoin(schema.kurumlar, eq(schema.evraklar.kurumId, schema.kurumlar.id))
    .leftJoin(schema.birimler, eq(schema.evraklar.birimId, schema.birimler.id))
    .where(eq(schema.evraklar.takipNo, takipNo.trim().toUpperCase()));

  if (!row) return null;
  const { evrak } = row;

  return {
    takipNo: evrak.takipNo,
    durum: evrak.durum,
    evrakTuru: evrak.evrakTuru,
    kurumAdi: row.kurumAdi,
    olusturmaZamani: evrak.olusturmaZamani ? new Date(evrak.olusturmaZamani).getTime() : null,
    // Only reveal the response once the case has actually gone out.
    belge:
      evrak.durum === "gonderildi"
        ? evraktanModel(evrak, row.kurumAdi ?? "Kurum", row.birimAdi ?? undefined)
        : null,
    bildirimGonderildiMi: evrak.bildirimGonderildiMi,
  };
}
