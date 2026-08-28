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

/** Longer than this and a first line is prose, not a makam başlığı. */
const HITAP_AZAMI_UZUNLUK = 90;

/**
 * Lifts a petition's own addressee line out of the body.
 *
 * A dilekçe opens with the makam başlığı ("… BAKANLIĞINA", "İLGİLİ MAKAMA")
 * — rule 1 of the drafting prompt — and every renderer already has a centred
 * slot for exactly that. Leaving it in the body meant the document showed the
 * slot's own "İLGİLİ MAKAMA" fallback and then a second, different salutation
 * one line below it.
 *
 * Only a first line that reads like a heading is taken: short, not a
 * "Konu:"-style labelled field, and not a finished sentence.
 *
 * A "Konu:" line immediately below it is dropped for the same reason: every
 * renderer already prints "Konu :" from the document's own başlık, so one in
 * the body is always the second copy. The drafting prompt asks the model not
 * to write one, but a prompt is a request — this is the guarantee.
 */
function hitabiAyir(govdeMetni: string): { hitap?: string; govde: string } {
  const satirlar = govdeMetni.split("\n");
  const ilkDoluIndeks = satirlar.findIndex((sat) => sat.trim().length > 0);
  if (ilkDoluIndeks === -1) return { govde: govdeMetni };

  const aday = satirlar[ilkDoluIndeks].trim();
  const basliksiMi =
    aday.length <= HITAP_AZAMI_UZUNLUK && !aday.includes(":") && !/[.!?]$/.test(aday);
  if (!basliksiMi) return { govde: govdeMetni };

  const kalan = satirlar.slice(ilkDoluIndeks + 1);
  const konuIndeks = kalan.findIndex((sat) => sat.trim().length > 0);
  if (konuIndeks !== -1 && /^Konu\s*:/i.test(kalan[konuIndeks].trim())) {
    kalan.splice(konuIndeks, 1);
  }

  return {
    hitap: trUpper(aday),
    govde: kalan.join("\n").replace(/^\s+/, ""),
  };
}

export function belgedenModel(
  belge: BelgeKaydi,
  kurumAdi: string,
  birimAdi: string | undefined,
  imza: { adSoyad: string; unvan: string }
): ResmiBelge {
  const tur = belgeTuruGetir(belge.belgeTuru);
  const kaynaklar: ResmiBelgeKaynagi[] = JSON.parse(belge.kaynaklar || "[]");

  // A dilekçe is written *by* a citizen *to* an institution, so it carries none
  // of the chrome an institution's own correspondence does: no "T.C. <KURUM>"
  // letterhead, no registry number, no staff signature block. Stamping them
  // printed the anonymous citizen session's anchor institution — a municipality
  // — on top of every petition, whatever it was about and whoever it was
  // addressed to, on screen and in every PDF/DOCX/UDF export.
  const dilekceMi = belge.belgeTuru === "dilekce";
  const { hitap, govde } = dilekceMi
    ? hitabiAyir(belge.govdeMetni)
    : { hitap: undefined, govde: belge.govdeMetni };

  return {
    kurumAdi: dilekceMi ? undefined : trUpper(kurumAdi),
    birimAdi: dilekceMi ? undefined : birimAdi,
    belgeTuruAdi: tur?.ad ?? belge.belgeTuru,
    tarih: tarihFormatla(belge.olusturmaZamani),
    konu: belge.baslik,
    hitap,
    govdeMetni: govde,
    imza: dilekceMi ? undefined : imza,
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
