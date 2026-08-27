import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DilekceOnizlemeProps {
  /** The citizen's petition exactly as it was submitted. */
  metin: string;
  basvuruSahibiAdSoyad: string;
  basvuruSahibiIletisim?: string | null;
  /** Reference fields printed in the Sayı/Tarih position. */
  takipNo?: string;
  kayitNo?: string | null;
  tarih?: string;
  className?: string;
}

type DilekceBlogu =
  /** A "## " marked section label, e.g. "Dayanak", "Talep". */
  | { tur: "baslik"; metin: string }
  /** The subject line — "Konu: …" — kept as label + value, not a shouted heading. */
  | { tur: "konu"; deger: string }
  /** Flowing prose: indented and justified. */
  | { tur: "paragraf"; metin: string }
  /** Short lines whose own line breaks carry the meaning (address block, footer fields). */
  | { tur: "satirlar"; satirlar: string[] }
  | { tur: "liste"; ogeler: string[] };

const BASLIK_DESENI = /^#{1,6}\s+/;
const LISTE_DESENI = /^([-*•]|\d+[.)])\s+/;
const KONU_DESENI = /^konu\s*:\s*/i;
const ETIKET_DESENI = /^([^:]{2,24}?)\s*:\s*(.*)$/;
/** "T.C." on its own line — the opening of a standard Turkish petition. */
const TC_DESENI = /^t\.?\s*c\.?$/i;
/** Placeholders the pipeline leaves behind: "[EK BİLGİ GEREKLİ: …]", "[İl]", "[Okul Adı]". */
const YER_TUTUCU_DESENI = /\[[^\]]{1,80}\]/g;

/** Below this, a line is short enough that its break was almost certainly deliberate. */
const KISA_SATIR = 70;

function vurguTemizle(metin: string): string {
  return metin.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1");
}

/**
 * Splits a petition into blocks for display.
 *
 * Deliberately not `govdeBloklariniAyir`: that one serves outgoing letters,
 * where the author types continuous prose and a single newline is only a soft
 * wrap, so it merges consecutive lines into one paragraph. A petition is the
 * opposite — its address block, subject line and the "Tarih / Ad Soyad /
 * İletişim" footer are all short lines whose breaks are the formatting. Merging
 * them produced one run-on justified paragraph at the foot of the page.
 *
 * So line breaks are preserved by default, and a block is reflowed into a
 * paragraph only when it reads as prose: long (hard-wrapped) lines, or a single
 * sentence that ends in terminating punctuation.
 */
function dilekceBloklariniAyir(metin: string): DilekceBlogu[] {
  const bloklar: DilekceBlogu[] = [];
  let tampon: string[] = [];
  let liste: string[] = [];

  const tamponuKapat = () => {
    if (tampon.length === 0) return;
    const satirlar = tampon;
    tampon = [];

    if (satirlar.length === 1 && KONU_DESENI.test(satirlar[0])) {
      bloklar.push({ tur: "konu", deger: satirlar[0].replace(KONU_DESENI, "") });
      return;
    }

    const ortalama = satirlar.reduce((t, s) => t + s.length, 0) / satirlar.length;
    const tekCumle =
      satirlar.length === 1 && satirlar[0].length > 25 && /[.!?…]$/.test(satirlar[0]);

    if (ortalama > KISA_SATIR || tekCumle) {
      bloklar.push({ tur: "paragraf", metin: satirlar.join(" ") });
    } else {
      bloklar.push({ tur: "satirlar", satirlar });
    }
  };

  const listeyiKapat = () => {
    if (liste.length === 0) return;
    bloklar.push({ tur: "liste", ogeler: liste });
    liste = [];
  };

  for (const hamSatir of metin.split("\n")) {
    const satir = vurguTemizle(hamSatir.trim());

    if (BASLIK_DESENI.test(satir) && satir.replace(BASLIK_DESENI, "").length > 0) {
      tamponuKapat();
      listeyiKapat();
      const baslik = satir.replace(BASLIK_DESENI, "");
      // "## Konu: …" is a subject line that happens to be marked as a heading.
      if (KONU_DESENI.test(baslik)) {
        bloklar.push({ tur: "konu", deger: baslik.replace(KONU_DESENI, "") });
      } else {
        bloklar.push({ tur: "baslik", metin: baslik });
      }
    } else if (satir === "") {
      tamponuKapat();
      listeyiKapat();
    } else if (LISTE_DESENI.test(satir)) {
      tamponuKapat();
      liste.push(satir.replace(LISTE_DESENI, ""));
    } else {
      listeyiKapat();
      tampon.push(satir);
    }
  }
  tamponuKapat();
  listeyiKapat();

  return bloklar;
}

/**
 * How many leading blocks form the letterhead — the "T.C." line and the
 * addressee under it, which belong centred at the top of the page rather than
 * flush left. Only counted when the petition actually opens that way (a "T.C."
 * line or an all-caps addressee); otherwise nothing is centred.
 */
function antetUzunlugu(bloklar: DilekceBlogu[]): number {
  const ilkMetin =
    bloklar[0]?.tur === "baslik"
      ? bloklar[0].metin
      : bloklar[0]?.tur === "satirlar"
      ? bloklar[0].satirlar[0]
      : null;
  if (!ilkMetin) return 0;

  const antetGibi =
    TC_DESENI.test(ilkMetin) || (ilkMetin === ilkMetin.toLocaleUpperCase("tr-TR") && ilkMetin.length < KISA_SATIR);
  if (!antetGibi) return 0;

  let sayi = 0;
  for (const blok of bloklar.slice(0, 3)) {
    if (blok.tur !== "baslik" && blok.tur !== "satirlar") break;
    sayi += 1;
  }
  return sayi;
}

/**
 * Marks up the "[…]" placeholders the intake pipeline leaves in a petition, so
 * a missing date reads as a blank waiting to be filled rather than as something
 * the citizen actually wrote.
 */
function yerTutuculariIsaretle(metin: string): ReactNode {
  const parcalar: ReactNode[] = [];
  let son = 0;
  for (const eslesme of metin.matchAll(YER_TUTUCU_DESENI)) {
    const bas = eslesme.index ?? 0;
    if (bas > son) parcalar.push(metin.slice(son, bas));
    parcalar.push(
      <span
        key={bas}
        className="rounded-xs bg-amber-100 px-1 italic text-zinc-600 ring-1 ring-amber-200"
      >
        {eslesme[0]}
      </span>
    );
    son = bas + eslesme[0].length;
  }
  if (son === 0) return metin;
  if (son < metin.length) parcalar.push(metin.slice(son));
  return <>{parcalar}</>;
}

/** A "Label: value" line keeps its label bold, the way a form field reads. */
function satirIcerigi(satir: string): ReactNode {
  const etiket = satir.match(ETIKET_DESENI);
  // A colon inside a placeholder ("[EK BİLGİ GEREKLİ: …]") is not a field label.
  if (!etiket || etiket[2].length === 0 || /[[\]]/.test(etiket[1])) {
    return yerTutuculariIsaretle(satir);
  }
  return (
    <>
      <span className="font-bold">{etiket[1]} : </span>
      {yerTutuculariIsaretle(etiket[2])}
    </>
  );
}

/**
 * Renders an incoming petition on paper instead of as a raw text blob. Every
 * field around the body is a column of the evrak row, and the body is the
 * citizen's text verbatim — only laid out the way the person typed it: A4
 * sheet, Tinos serif, centred letterhead, and the 10mm first-line indent used
 * in Turkish official correspondence on the prose paragraphs alone.
 */
export function DilekceOnizleme({
  metin,
  basvuruSahibiAdSoyad,
  basvuruSahibiIletisim,
  takipNo,
  kayitNo,
  tarih,
  className,
}: DilekceOnizlemeProps) {
  const bloklar = dilekceBloklariniAyir(metin);
  const antetSayisi = antetUzunlugu(bloklar);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[210mm] min-h-[297mm] bg-white text-zinc-950 shadow-lg ring-1 ring-black/10 rounded-xs",
        "p-[18mm] sm:p-[22mm]",
        className
      )}
      style={{
        fontFamily: '"Tinos", "Times New Roman", Times, "Liberation Serif", serif',
        fontSize: "12pt",
        lineHeight: 1.5,
        color: "#000000",
      }}
    >
      {/* Kayıt referansı — the counterpart of a Sayı/Tarih block on an outgoing
          letter. The petition's own addressee lines stay where the citizen
          wrote them, at the top of the body, rather than being duplicated here. */}
      {(takipNo || tarih) && (
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-2.5 text-[10.5pt]">
          <div className="space-y-0.5">
            {takipNo && (
              <div>
                <span className="font-bold">Başvuru No : </span>
                <span className="font-mono text-[10pt]">{takipNo}</span>
              </div>
            )}
            {kayitNo && (
              <div>
                <span className="font-bold">Kayıt No : </span>
                <span className="font-mono text-[10pt]">{kayitNo}</span>
              </div>
            )}
          </div>
          {tarih && (
            <div className="shrink-0 text-right">
              <span className="font-bold">Tarih : </span>
              {tarih}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 text-[11pt] leading-[1.6]">
        {bloklar.length === 0 ? (
          <p className="py-10 text-center italic text-zinc-400">[Dilekçe metni boş]</p>
        ) : (
          bloklar.map((blok, i) => {
            const antette = i < antetSayisi;

            if (blok.tur === "konu") {
              return (
                <div key={i} className="mt-7 mb-6 flex gap-1.5">
                  <span className="shrink-0 font-bold">Konu :</span>
                  <span className="font-semibold">{yerTutuculariIsaretle(blok.deger)}</span>
                </div>
              );
            }

            if (blok.tur === "baslik") {
              return (
                <p
                  key={i}
                  className={cn(
                    "font-bold",
                    antette
                      ? "text-center tracking-widest text-[12pt]"
                      : "mt-6 mb-1.5 text-[11.5pt]"
                  )}
                >
                  {blok.metin}
                </p>
              );
            }

            if (blok.tur === "liste") {
              return (
                <ul key={i} className="my-3 list-disc space-y-1 pl-[12mm] text-justify">
                  {blok.ogeler.map((oge, j) => (
                    <li key={j}>{yerTutuculariIsaretle(oge)}</li>
                  ))}
                </ul>
              );
            }

            if (blok.tur === "satirlar") {
              return (
                <div
                  key={i}
                  className={cn("mb-4", antette ? "text-center font-bold" : "space-y-0.5")}
                >
                  {blok.satirlar.map((satir, j) => (
                    <div key={j}>
                      {antette ? yerTutuculariIsaretle(satir) : satirIcerigi(satir)}
                    </div>
                  ))}
                </div>
              );
            }

            return (
              <p key={i} className="mb-3 text-justify [text-indent:10mm]">
                {yerTutuculariIsaretle(blok.metin)}
              </p>
            );
          })
        )}
      </div>

      {/* Başvuru sahibi — labelled, because a petition often carries the
          citizen's own sign-off in its text; this block is the record's
          registered applicant, not a second signature. */}
      <div className="mt-12 flex justify-end">
        <div className="min-w-[200px] border-t border-zinc-300 pt-1.5 text-center">
          <div className="mb-0.5 text-[9pt] uppercase tracking-wider text-zinc-500">
            Başvuru Sahibi
          </div>
          <div className="font-bold text-[11.5pt]">{basvuruSahibiAdSoyad}</div>
          {basvuruSahibiIletisim && (
            <div className="mt-0.5 text-[10pt] text-zinc-700">{basvuruSahibiIletisim}</div>
          )}
        </div>
      </div>
    </div>
  );
}
