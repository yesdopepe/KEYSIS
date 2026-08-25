"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { basvuruIsle, type BasvuruSonucu } from "@/lib/cases/pipeline";
import { evraktanModel } from "@/lib/belgeler/modelle";
import type { ResmiBelge } from "@/lib/belgeler/resmi-belge";

const DOCLING_URL = process.env.DOCLING_SERVICE_URL ?? "http://localhost:8100";

async function dosyadanMetinCikar(dosya: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", dosya, dosya.name);

  const res = await fetch(`${DOCLING_URL}/convert`, { method: "POST", body: formData });
  if (!res.ok) {
    throw new Error(`Belge ayrıştırma servisi hata döndürdü (${res.status}).`);
  }
  const data = (await res.json()) as { raw_text: string };
  return data.raw_text;
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
}): Promise<BasvuruFormSonucu> {
  let dilekceMetni = input.dilekceMetni;

  if (input.dosya && input.dosya.size > 0) {
    const dosyaMetni = await dosyadanMetinCikar(input.dosya);
    dilekceMetni = `${dilekceMetni}\n\n${dosyaMetni}`.trim();
  }

  if (input.ekCevaplar && Object.keys(input.ekCevaplar).length > 0) {
    const ekMetin = Object.entries(input.ekCevaplar)
      .map(([alan, deger]) => `${alan}: ${deger}`)
      .join("\n");
    dilekceMetni = `${dilekceMetni}\n\nEk Bilgiler:\n${ekMetin}`;
  }

  if (!dilekceMetni.trim()) {
    throw new Error("Dilekçe metni boş olamaz.");
  }

  const sonuc = await basvuruIsle({
    dilekceMetni,
    basvuruSahibiAdSoyad: input.basvuruSahibiAdSoyad,
    basvuruSahibiIletisim: input.basvuruSahibiIletisim,
    dosyaAdi: input.dosya?.name,
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
