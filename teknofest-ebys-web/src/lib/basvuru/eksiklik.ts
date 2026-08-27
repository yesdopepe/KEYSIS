/**
 * Placeholder handling for citizen petitions.
 *
 * Both drafting paths — the chat assistant and the "AI ile oluştur" button —
 * leave gaps in the text they cannot know: "Tarih: [EK BİLGİ GEREKLİ: Tarih]",
 * "[İl] Millî Eğitim Müdürlüğüne". Until this module existed those markers went
 * through intake unchanged and were filed as if the citizen had written them,
 * which is how a registered evrak ended up with "[EK BİLGİ GEREKLİ: Ad Soyad]"
 * in place of a name.
 *
 * Deliberately free of `server-only` and of any db/ai import: the same rules
 * have to run in the browser (to disable the send button before anything is
 * submitted) and on the server (the gate that actually decides), and a check
 * that exists only on the client is not a gate.
 */

export interface EksikAlan {
  alan: string;
  soru: string;
}

/** "[…]" spans: "[EK BİLGİ GEREKLİ: Tarih]", "[İl]", "[Okul Adı]". */
const YER_TUTUCU_DESENI = /\[[^\][]{1,120}\]/g;
/** The drafting agents' explicit marker; the label follows the colon. */
const GEREKLI_ONEKI = /^ek\s*b[iİı]lg[iİı]\s*gerekl[iİı]\s*:\s*/i;

/**
 * A gap is something the citizen can type only when it names a field. The same
 * marker is also used for notes the citizen cannot answer — "[EK BİLGİ
 * GEREKLİ: bu konuya ilişkin mevzuat dayanağı bulunamadı]" is the drafting
 * agent reporting that it found no legal basis, not a question. Blocking a
 * submission on that would leave the citizen with no way forward, so length
 * and word count separate a field label from a sentence.
 */
const EN_UZUN_ALAN_ADI = 45;
const EN_COK_KELIME = 5;

function etiketCoz(yerTutucu: string): string {
  return yerTutucu.slice(1, -1).replace(GEREKLI_ONEKI, "").trim();
}

function alanMi(etiket: string): boolean {
  if (etiket.length === 0 || etiket.length > EN_UZUN_ALAN_ADI) return false;
  return etiket.split(/\s+/).length <= EN_COK_KELIME;
}

function anahtar(etiket: string): string {
  return etiket.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

/**
 * The fields a petition still needs before it can be submitted, in the order
 * they appear in the text. Notes the citizen cannot answer are left out.
 */
export function eksikYerTutucular(metin: string): EksikAlan[] {
  const gorulen = new Set<string>();
  const eksikler: EksikAlan[] = [];

  for (const eslesme of metin.matchAll(YER_TUTUCU_DESENI)) {
    const etiket = etiketCoz(eslesme[0]);
    if (!alanMi(etiket)) continue;

    const kod = anahtar(etiket);
    if (gorulen.has(kod)) continue;
    gorulen.add(kod);

    eksikler.push({ alan: etiket, soru: `${etiket} bilgisini giriniz.` });
  }

  return eksikler;
}

/**
 * Writes the citizen's answers back into the petition, replacing every
 * placeholder that names the answered field.
 *
 * This is what lets the missing-information round trip terminate: answers used
 * to be appended under an "Ek Bilgiler" heading while the placeholders stayed
 * in the body, so a text that was rejected for having gaps still had exactly
 * the same gaps on resubmission. Answers whose field matches no placeholder are
 * returned in `artanlar` for the caller to append.
 */
export function yerTutuculariDoldur(
  metin: string,
  cevaplar: Record<string, string>
): { metin: string; artanlar: Record<string, string> } {
  const kalanlar = new Map(
    Object.entries(cevaplar)
      .filter(([, deger]) => deger.trim().length > 0)
      .map(([alan, deger]) => [anahtar(alan), { alan, deger: deger.trim() }])
  );
  const kullanilan = new Set<string>();

  const yeniMetin = metin.replace(YER_TUTUCU_DESENI, (yerTutucu) => {
    const kod = anahtar(etiketCoz(yerTutucu));
    const cevap = kalanlar.get(kod);
    if (!cevap) return yerTutucu;
    kullanilan.add(kod);
    return cevap.deger;
  });

  const artanlar: Record<string, string> = {};
  for (const [kod, { alan, deger }] of kalanlar) {
    if (!kullanilan.has(kod)) artanlar[alan] = deger;
  }

  return { metin: yeniMetin, artanlar };
}
