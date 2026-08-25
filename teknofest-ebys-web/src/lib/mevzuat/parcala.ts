/**
 * Splits legislation text into individual articles. Kept free of any server
 * dependency (no db, no vector store) so the parsing rules can be exercised
 * on their own — the split is the part most likely to meet a document format
 * it wasn't designed for.
 */

/**
 * Turkish legislation marks articles with "MADDE <n> –". Tolerates an en
 * dash, a hyphen, or no separator at all, since published texts are
 * inconsistent about it.
 */
const MADDE_DESENI = /^MADDE\s+(\d+)\s*[–—-]?\s*/i;

/** A title line above an article is short; a long line is body text. */
const BASLIK_AZAMI_UZUNLUK = 60;

export interface AyrilmisMadde {
  kodu: string;
  baslik: string;
  icerik: string;
}

/**
 * A short line immediately preceding a "MADDE n" header is that article's
 * title — the convention used throughout Turkish yönetmelikler ("Amaç\nMADDE
 * 1 – ..."); laws often omit it, so the title falls back to
 * "<kanun adı> m.<n>".
 *
 * If no article headers are found at all the whole text becomes a single
 * article rather than being dropped, mirroring how metniParcala degrades when
 * a document has no paragraph breaks.
 */
export function mevzuatMetniParcala(
  metin: string,
  kanunKodu: string,
  kanunAdi: string
): AyrilmisMadde[] {
  const maddeler: AyrilmisMadde[] = [];

  let mevcut: { no: string; baslik: string | null; govde: string[] } | null = null;
  // Tracks the last non-empty line so a heading can be claimed as a title.
  let oncekiSatir = "";

  const maddeyiKapat = () => {
    if (!mevcut) return;
    maddeler.push({
      kodu: `${kanunKodu}/${mevcut.no}`,
      baslik: mevcut.baslik ?? `${kanunAdi} m.${mevcut.no}`,
      icerik: mevcut.govde.join("\n").trim(),
    });
    mevcut = null;
  };

  for (const rawLine of metin.split("\n")) {
    const satir = rawLine.trim();
    const eslesme = satir.match(MADDE_DESENI);

    if (eslesme) {
      maddeyiKapat();
      const onceki = oncekiSatir.trim();
      const baslikAdayi =
        onceki.length > 0 && onceki.length <= BASLIK_AZAMI_UZUNLUK && !MADDE_DESENI.test(onceki)
          ? onceki
          : null;

      mevcut = {
        no: eslesme[1],
        baslik: baslikAdayi,
        // Keep whatever followed the header on the same line.
        govde: [satir.replace(MADDE_DESENI, "").trim()].filter(Boolean),
      };
    } else if (mevcut) {
      mevcut.govde.push(satir);
    }

    if (satir.length > 0) oncekiSatir = satir;
  }
  maddeyiKapat();

  if (maddeler.length === 0) {
    const tam = metin.trim();
    return tam ? [{ kodu: kanunKodu, baslik: kanunAdi, icerik: tam }] : [];
  }

  // A title line was consumed as the *next* article's heading, so strip it
  // off the end of the previous article's body.
  return maddeler.map((madde, i) => {
    const sonraki = maddeler[i + 1];
    if (!sonraki) return madde;
    const satirlar = madde.icerik.split("\n");
    if (satirlar[satirlar.length - 1]?.trim() === sonraki.baslik) {
      return { ...madde, icerik: satirlar.slice(0, -1).join("\n").trim() };
    }
    return madde;
  });
}
