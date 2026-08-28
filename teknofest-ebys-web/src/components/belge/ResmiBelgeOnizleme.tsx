"use client";

import type { ReactNode } from "react";
import { govdeBloklariniAyir, type ResmiBelge } from "@/lib/belgeler/resmi-belge";
import { cn } from "@/lib/utils";

export interface ResmiBelgeOnizlemeProps {
  belge: ResmiBelge;
  className?: string;
  govdeSlot?: ReactNode;
  olcek?: number;
  duzenlenebilir?: boolean;
  onKurumDegisti?: (yeniKurum: string) => void;
  onBirimDegisti?: (yeniBirim: string) => void;
  onSayiDegisti?: (yeniSayi: string) => void;
  onTarihDegisti?: (yeniTarih: string) => void;
  onKonuDegisti?: (yeniKonu: string) => void;
  onHitapDegisti?: (yeniHitap: string) => void;
  onImzaAdSoyadDegisti?: (yeniAdSoyad: string) => void;
  onImzaUnvanDegisti?: (yeniUnvan: string) => void;
  onEklerDegisti?: (yeniEkler: string[]) => void;
  onDagitimDegisti?: (yeniDagitim: string[]) => void;
}

/**
 * Full-Document WYSIWYG Editor (Resmî Yazışma Standartı).
 * The ENTIRE paper is a normal, continuous, in-place editable document (Word/Docs style):
 * Header / Antet, Sayı, Tarih, Konu, Hitap, Body paragraphs, Signature, Attachments.
 * No HTML form inputs, no artificial boxes — everything is natural editable text.
 */
export function ResmiBelgeOnizleme({
  belge,
  className = "",
  govdeSlot,
  olcek = 1,
  duzenlenebilir = false,
  onKurumDegisti,
  onBirimDegisti,
  onSayiDegisti,
  onTarihDegisti,
  onKonuDegisti,
  onHitapDegisti,
  onImzaAdSoyadDegisti,
  onImzaUnvanDegisti,
}: ResmiBelgeOnizlemeProps) {
  const bloklar = govdeBloklariniAyir(belge.govdeMetni);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[210mm] min-h-[297mm] bg-white text-zinc-950 shadow-2xl ring-1 ring-black/10 rounded-xs transition-transform duration-200",
        "p-[18mm] sm:p-[22mm] md:p-[25mm]",
        "font-serif leading-[1.6]",
        className
      )}
      style={{
        transform: olcek !== 1 ? `scale(${olcek})` : undefined,
        transformOrigin: "top center",
        fontFamily: '"Tinos", "Times New Roman", Times, "Liberation Serif", serif',
        fontSize: "12pt",
        lineHeight: 1.5,
        color: "#000000",
      }}
    >
      {/* 1. T.C. Antet (Letterhead) — only for a document an institution issues.
          A dilekçe is written by a citizen and carries no letterhead; printing a
          placeholder (or the anonymous session's anchor institution) put a
          municipality's name on top of every petition. */}
      {belge.kurumAdi ? (
      <div className="text-center select-text">
        <div className="font-bold tracking-widest text-[12pt] text-zinc-950">T.C.</div>
        <div
          contentEditable={duzenlenebilir}
          suppressContentEditableWarning
          onBlur={(e) => onKurumDegisti?.(e.currentTarget.textContent?.trim() || "")}
          className={cn(
            "font-bold uppercase tracking-wider text-[12pt] text-zinc-950 mt-0.5 outline-none transition-colors",
            duzenlenebilir && "hover:bg-zinc-100/70 focus:bg-primary/[0.02] focus:ring-1 focus:ring-primary/20 rounded-xs px-1 cursor-text"
          )}
        >
          {belge.kurumAdi}
        </div>
        <div
          contentEditable={duzenlenebilir}
          suppressContentEditableWarning
          onBlur={(e) => onBirimDegisti?.(e.currentTarget.textContent?.trim() || "")}
          className={cn(
            "font-normal text-[11pt] text-zinc-900 mt-0.5 outline-none transition-colors",
            duzenlenebilir && "hover:bg-zinc-100/70 focus:bg-primary/[0.02] focus:ring-1 focus:ring-primary/20 rounded-xs px-1 cursor-text"
          )}
        >
          {belge.birimAdi}
        </div>
      </div>
      ) : null}

      {/* 2. Sayı, Tarih & Konu (Meta Bilgileri) */}
      <div className="mt-8 grid grid-cols-12 gap-2 text-[11pt] text-zinc-950 border-b border-zinc-200 pb-3">
        <div className="col-span-8 space-y-1.5">
          {belge.sayi !== undefined ? (
          <div className="flex items-center gap-1.5">
            <span className="font-bold w-14 shrink-0 select-none">Sayı :</span>
            <span
              contentEditable={duzenlenebilir}
              suppressContentEditableWarning
              onBlur={(e) => onSayiDegisti?.(e.currentTarget.textContent?.trim() || "")}
              className={cn(
                "font-mono text-[10.5pt] text-zinc-800 outline-none transition-colors",
                duzenlenebilir && "hover:bg-zinc-100/70 focus:bg-primary/[0.02] focus:ring-1 focus:ring-primary/20 rounded-xs px-1 cursor-text"
              )}
            >
              {belge.sayi}
            </span>
          </div>
          ) : null}
          <div className="flex items-center gap-1.5">
            <span className="font-bold w-14 shrink-0 select-none">Konu :</span>
            <span
              contentEditable={duzenlenebilir}
              suppressContentEditableWarning
              onBlur={(e) => onKonuDegisti?.(e.currentTarget.textContent?.trim() || "")}
              className={cn(
                "font-semibold text-zinc-950 outline-none flex-1 transition-colors",
                duzenlenebilir && "hover:bg-zinc-100/70 focus:bg-primary/[0.02] focus:ring-1 focus:ring-primary/20 rounded-xs px-1 cursor-text"
              )}
            >
              {belge.konu || "Belge konusu"}
            </span>
          </div>
        </div>

        <div className="col-span-4 text-right flex flex-col justify-start">
          <div className="font-normal text-[11pt] text-zinc-950">
            <span className="font-bold select-none">Tarih : </span>
            <span
              contentEditable={duzenlenebilir}
              suppressContentEditableWarning
              onBlur={(e) => onTarihDegisti?.(e.currentTarget.textContent?.trim() || "")}
              className={cn(
                "outline-none transition-colors",
                duzenlenebilir && "hover:bg-zinc-100/70 focus:bg-primary/[0.02] focus:ring-1 focus:ring-primary/20 rounded-xs px-1 cursor-text"
              )}
            >
              {belge.tarih}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Hitap / Muhatap Bloğu */}
      <div className="my-7 text-center">
        <div
          contentEditable={duzenlenebilir}
          suppressContentEditableWarning
          onBlur={(e) => onHitapDegisti?.(e.currentTarget.textContent?.trim() || "")}
          className={cn(
            "font-bold text-[12pt] uppercase tracking-wider text-zinc-950 outline-none transition-colors",
            duzenlenebilir && "hover:bg-zinc-100/70 focus:bg-primary/[0.02] focus:ring-1 focus:ring-primary/20 rounded-xs px-2 py-0.5 cursor-text"
          )}
        >
          {belge.hitap || "İLGİLİ MAKAMA"}
        </div>
      </div>

      {/* 4. Gövde Metni (Body) */}
      <div className="text-[11pt] text-zinc-950 leading-[1.6] min-h-[160px] select-text">
        {govdeSlot ??
          (bloklar.length === 0 ? (
            <p className="mb-2 text-zinc-400 italic text-center py-10 select-none">
              [Belge metni henüz oluşturulmadı]
            </p>
          ) : (
            bloklar.map((blok, i) => {
              if (blok.tur === "baslik") {
                return (
                  <h4 key={i} className="mt-5 mb-2 font-bold uppercase text-[11.5pt] text-zinc-950">
                    {blok.metin.toLocaleUpperCase("tr-TR")}
                  </h4>
                );
              }
              if (blok.tur === "liste") {
                return (
                  <ul key={i} className="my-2.5 list-disc space-y-1 pl-[12mm] text-justify">
                    {blok.ogeler.map((oge, j) => (
                      <li key={j}>{oge}</li>
                    ))}
                  </ul>
                );
              }
              return (
                <p key={i} className="mb-3 text-justify [text-indent:10mm] leading-[1.6]">
                  {blok.metin}
                </p>
              );
            })
          ))}
      </div>

      {/* 5. İmza Bloğu (Formal Signature Block) — a dilekçe signs itself in the
          body ("Ad Soyad / T.C. Kimlik No / İletişim"), so a second staff-style
          signature block below it would only contradict the petitioner. */}
      {belge.imza ? (
      <div className="mt-14 flex justify-end">
        <div className="text-center min-w-[200px] space-y-1">
          <div className="italic text-[10pt] text-zinc-400 select-none">(İmza)</div>
          <div
            contentEditable={duzenlenebilir}
            suppressContentEditableWarning
            onBlur={(e) => onImzaAdSoyadDegisti?.(e.currentTarget.textContent?.trim() || "")}
            className={cn(
              "font-bold text-[11.5pt] text-zinc-950 outline-none transition-colors",
              duzenlenebilir && "hover:bg-zinc-100/70 focus:bg-primary/[0.02] focus:ring-1 focus:ring-primary/20 rounded-xs px-1 cursor-text"
            )}
          >
            {belge.imza.adSoyad}
          </div>
          <div
            contentEditable={duzenlenebilir}
            suppressContentEditableWarning
            onBlur={(e) => onImzaUnvanDegisti?.(e.currentTarget.textContent?.trim() || "")}
            className={cn(
              "text-[10.5pt] text-zinc-800 outline-none transition-colors",
              duzenlenebilir && "hover:bg-zinc-100/70 focus:bg-primary/[0.02] focus:ring-1 focus:ring-primary/20 rounded-xs px-1 cursor-text"
            )}
          >
            {belge.imza.unvan}
          </div>
        </div>
      </div>
      ) : null}

      {/* 6. Ekler (Attachments) */}
      {belge.ekler && belge.ekler.length > 0 && (
        <div className="mt-10 border-t border-zinc-300 pt-3 text-[10.5pt]">
          <div className="font-bold text-zinc-950 mb-1">EKLER :</div>
          <ol className="list-decimal pl-6 space-y-0.5 text-zinc-900">
            {belge.ekler.map((e, i) => (
              <li
                key={i}
                contentEditable={duzenlenebilir}
                suppressContentEditableWarning
                className={cn(
                  "outline-none transition-colors",
                  duzenlenebilir && "hover:bg-zinc-100/70 focus:bg-primary/[0.02] focus:ring-1 focus:ring-primary/20 rounded-xs px-1 cursor-text"
                )}
              >
                {e}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 7. Dağıtım (Distribution) */}
      {belge.dagitim && belge.dagitim.length > 0 && (
        <div className="mt-5 border-t border-zinc-200 pt-2.5 text-[10.5pt]">
          <div className="font-bold text-zinc-950 mb-1">DAĞITIM :</div>
          <ul className="list-disc pl-6 space-y-0.5 text-zinc-900">
            {belge.dagitim.map((d, i) => (
              <li
                key={i}
                contentEditable={duzenlenebilir}
                suppressContentEditableWarning
                className={cn(
                  "outline-none transition-colors",
                  duzenlenebilir && "hover:bg-zinc-100/70 focus:bg-primary/[0.02] focus:ring-1 focus:ring-primary/20 rounded-xs px-1 cursor-text"
                )}
              >
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 8. Yasal Dayanak & Kaynaklar */}
      {belge.kaynaklar && belge.kaynaklar.length > 0 && (
        <div className="mt-10 border-t border-zinc-300 pt-2 text-[9.5pt] text-zinc-600">
          <div className="font-bold text-zinc-800 uppercase tracking-wider mb-1">YASAL DAYANAK VE MEVZUAT :</div>
          <div className="space-y-0.5">
            {belge.kaynaklar.map((k, i) => (
              <div key={i}>
                • <span className="font-semibold text-zinc-800">{k.referans}</span> {k.aciklama ? `— ${k.aciklama}` : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
