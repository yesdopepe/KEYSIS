export type DurumTon = "notr" | "bilgi" | "uyari" | "basari" | "tehlike";

export interface DurumBilgisi {
  etiket: string;
  ton: DurumTon;
}

/**
 * Canonical Turkish label + semantic tone for every durum value — shared by
 * evrak and belge, since onay_zincirinde/onaylandi/reddedildi mean the same
 * thing for both (see src/lib/onay/adimlar.ts). taslak/tamamlandi exist only
 * for belge; the rest below them are evrak-only.
 */
export const DURUM_BILGISI: Record<string, DurumBilgisi> = {
  taslak: { etiket: "Taslak", ton: "uyari" },
  tamamlandi: { etiket: "Tamamlandı", ton: "basari" },
  onay_zincirinde: { etiket: "Onay Sürecinde", ton: "bilgi" },
  onaylandi: { etiket: "Onaylandı", ton: "bilgi" },
  reddedildi: { etiket: "Reddedildi", ton: "tehlike" },

  yeni: { etiket: "Yeni", ton: "notr" },
  ic_incelemede: { etiket: "İnceleniyor", ton: "uyari" },
  taslak_hazirlaniyor: { etiket: "Yanıt Hazırlanıyor", ton: "uyari" },
  gonderildi: { etiket: "Yanıtlandı", ton: "basari" },
  bekliyor: { etiket: "Bekliyor", ton: "uyari" },
};

export function durumBilgisiGetir(durum: string): DurumBilgisi {
  return DURUM_BILGISI[durum] ?? { etiket: durum, ton: "notr" };
}
