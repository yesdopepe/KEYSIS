/**
 * Canonical official-document model. Every renderer (screen preview, PDF,
 * DOCX, UDF) consumes this one shape, so a citizen response letter and a
 * staff-authored tutanak come out looking like the same institution wrote
 * them. Field order and naming follow "Resmî Yazışmalarda Uygulanacak Usul
 * ve Esaslar Hakkında Yönetmelik" — the actual Turkish standard for
 * official correspondence.
 *
 * The body (`govdeMetni`) is a single flowing text, not a fixed set of
 * named fields — the author (AI or human) decides what sections a given
 * document needs and marks a heading by starting its line with "## ".
 * There is no enforced template: a tutanak about a routine inspection and
 * one about a multi-party dispute can end up with completely different
 * internal structure, exactly as a person writing them by hand would.
 */

export interface ResmiBelgeKaynagi {
  referans: string;
  aciklama: string;
  /**
   * In-app link to the cited mevzuat article. Screen-only — the PDF/DOCX/UDF
   * renderers ignore it, since a link means nothing on paper.
   */
  link?: string;
}

export interface ResmiBelgeImza {
  adSoyad: string;
  unvan: string;
}

export interface ResmiBelge {
  /**
   * Shown under the T.C. line, e.g. "ÇANKAYA BELEDİYE BAŞKANLIĞI".
   *
   * Optional, and absent for a dilekçe: a petition is written *by* a citizen,
   * so it carries no institutional letterhead at all. Every renderer omits the
   * whole T.C. antet when this is empty rather than substituting a placeholder
   * — a stamped institution name is a claim about who issued the document, and
   * a wrong one is worse than none.
   */
  kurumAdi?: string;
  /** Second header line, e.g. "Fen İşleri Müdürlüğü". */
  birimAdi?: string;
  /** Document kind, used for the export filename and the preview label. */
  belgeTuruAdi: string;

  sayi?: string;
  tarih: string;
  konu?: string;
  /** Addressee block, e.g. "Sayın Ayşe YILMAZ" or "… BAŞKANLIĞINA". */
  hitap?: string;

  /**
   * The document body as one continuous text. Blank lines separate
   * paragraphs; a line starting with "## " is a section heading. Nothing
   * else is structured — an "İlgi:" reference line, list items, and the
   * closing formula ("Bilgilerinize rica ederim.") are just ordinary text
   * the author writes as part of the flow.
   */
  govdeMetni: string;

  imza?: ResmiBelgeImza;
  ekler?: string[];
  dagitim?: string[];
  /** Legal basis citations, rendered as a footer block. */
  kaynaklar?: ResmiBelgeKaynagi[];
}

export type GovdeBlogu =
  | { tur: "baslik"; metin: string }
  | { tur: "paragraf"; metin: string }
  | { tur: "liste"; ogeler: string[] };

const LISTE_DESENI = /^([-*•]|\d+[.)])\s+/;

/**
 * A labelled field line — "Tarih: …", "Ad Soyad: …", "T.C. Kimlik No: …".
 *
 * Consecutive non-empty lines are otherwise joined into one paragraph, because
 * inside prose a single newline is only a soft wrap. That is wrong for a
 * document's field blocks, whose line breaks *are* the formatting: a dilekçe's
 * closing block came out as one run-on sentence
 * ("Tarih: … Ad-Soyad: … T.C. Kimlik No: …"). A short label followed by a
 * colon is never the continuation of the sentence above it, so it starts its
 * own block. The label bound keeps ordinary prose that merely contains a colon
 * from tripping it.
 */
const ETIKET_DESENI = /^[^:]{2,24}:\s/;

/**
 * Splits a flowing body into typed blocks a renderer can lay out: headings
 * (lines starting with "## ") get bold/emphasis treatment, lines starting
 * with "- ", "* " or "1. " become a list (kept as separate lines rather
 * than merged into one run-on paragraph), everything else becomes ordinary
 * paragraphs. A soft line break inside a paragraph (single "\n") does not
 * start a new paragraph — only a blank line, a heading, or a list does —
 * matching how a person would type this in a normal text editor.
 */
/**
 * Strips markdown emphasis markers — "**kalın**", "__kalın__" — that
 * occasionally slip into model output despite every writer/reviser prompt
 * instructing plain text. This document model has no inline-formatting
 * concept at all (see the module comment above: paragraphs, headings, and
 * lists are the only structure), so an asterisk pair here is never
 * something a person typed on purpose — unwrapping it is always correct,
 * never a guess. Applied to already-extracted block text, after "## "/"- "
 * have already been consumed as structural markers, so a line's own list
 * bullet is untouched by this.
 */
function vurguTemizle(metin: string): string {
  return metin.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
}

export function govdeBloklariniAyir(govdeMetni: string): GovdeBlogu[] {
  const bloklar: GovdeBlogu[] = [];
  let mevcutSatirlar: string[] = [];
  let mevcutListe: string[] = [];

  const paragrafiKapat = () => {
    if (mevcutSatirlar.length > 0) {
      bloklar.push({ tur: "paragraf", metin: vurguTemizle(mevcutSatirlar.join(" ")) });
      mevcutSatirlar = [];
    }
  };
  const listeyiKapat = () => {
    if (mevcutListe.length > 0) {
      bloklar.push({ tur: "liste", ogeler: mevcutListe });
      mevcutListe = [];
    }
  };

  for (const rawLine of govdeMetni.split("\n")) {
    const line = rawLine.trim();
    if (/^#{1,6}\s*/.test(line) && line.replace(/^#{1,6}\s*/, "").length > 0) {
      paragrafiKapat();
      listeyiKapat();
      bloklar.push({ tur: "baslik", metin: vurguTemizle(line.replace(/^#{1,6}\s*/, "")) });
    } else if (line === "") {
      paragrafiKapat();
      listeyiKapat();
    } else if (LISTE_DESENI.test(line)) {
      paragrafiKapat();
      mevcutListe.push(vurguTemizle(line.replace(LISTE_DESENI, "")));
    } else if (ETIKET_DESENI.test(line)) {
      paragrafiKapat();
      listeyiKapat();
      bloklar.push({ tur: "paragraf", metin: vurguTemizle(line) });
    } else {
      listeyiKapat();
      mevcutSatirlar.push(line);
    }
  }
  paragrafiKapat();
  listeyiKapat();

  return bloklar;
}

const AY_ADLARI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** dd.MM.yyyy — the numeric form used in the Sayı/Tarih block. */
export function tarihFormatla(d: Date): string {
  const gun = String(d.getDate()).padStart(2, "0");
  const ay = String(d.getMonth() + 1).padStart(2, "0");
  return `${gun}.${ay}.${d.getFullYear()}`;
}

/** "20 Ağustos 2026" — the long form used in document bodies. */
export function tarihUzunFormatla(d: Date): string {
  return `${d.getDate()} ${AY_ADLARI[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Safe base filename for an export. Turkish characters are transliterated
 * because the ASCII fallback in Content-Disposition must stay ASCII —
 * the UTF-8 form is sent alongside it for clients that support it.
 */
export function dosyaAdiNormalize(metin: string): string {
  const harita: Record<string, string> = {
    ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I",
    ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U",
  };
  return metin
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => harita[c] ?? c)
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "belge";
}
