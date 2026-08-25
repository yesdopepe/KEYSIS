import { trUpper } from "@/lib/search/metin-benzerligi";
import { belgeTuruGetir } from "./turler";
import { tarihFormatla, type ResmiBelge, type ResmiBelgeKaynagi } from "./resmi-belge";
import { yanitTaslagiCoz } from "./yanit-taslagi";

/**
 * Adapters from each storage shape to the canonical ResmiBelge. Keeping
 * them here means no renderer or export route needs to know whether a
 * document came from the citizen pipeline or the staff authoring tool.
 */

export interface BelgeKaydi {
  belgeTuru: string;
  baslik: string;
  govdeMetni: string;
  kaynaklar: string;
  olusturmaZamani: Date;
}

export function belgedenModel(
  belge: BelgeKaydi,
  kurumAdi: string,
  birimAdi: string | undefined,
  imza: { adSoyad: string; unvan: string }
): ResmiBelge {
  const tur = belgeTuruGetir(belge.belgeTuru);
  const kaynaklar: ResmiBelgeKaynagi[] = JSON.parse(belge.kaynaklar);

  return {
    kurumAdi: trUpper(kurumAdi),
    birimAdi,
    belgeTuruAdi: tur?.ad ?? belge.belgeTuru,
    tarih: tarihFormatla(belge.olusturmaZamani),
    konu: belge.baslik,
    govdeMetni: belge.govdeMetni,
    imza,
    kaynaklar,
  };
}

export interface EvrakKaydi {
  kayitNo: string | null;
  takipNo: string;
  basvuruSahibiAdSoyad: string;
  taslakYapisi: string | null;
  guncellemeZamani: Date;
}

export function evraktanModel(
  evrak: EvrakKaydi,
  kurumAdi: string,
  birimAdi: string | undefined,
  imza?: { adSoyad: string; unvan: string }
): ResmiBelge | null {
  const taslak = yanitTaslagiCoz(evrak.taslakYapisi);
  if (!taslak) return null;

  return {
    kurumAdi: trUpper(kurumAdi),
    birimAdi,
    belgeTuruAdi: "Resmi Yazı",
    sayi: evrak.kayitNo ?? undefined,
    tarih: tarihFormatla(evrak.guncellemeZamani),
    konu: taslak.konu,
    hitap: taslak.hitap || `Sayın ${evrak.basvuruSahibiAdSoyad}`,
    govdeMetni: taslak.govdeMetni,
    imza,
    dagitim: [`${evrak.basvuruSahibiAdSoyad} (Takip No: ${evrak.takipNo})`],
  };
}
