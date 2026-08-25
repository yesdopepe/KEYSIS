"use client";

import { useEffect, useRef } from "react";
import { CheckCircle } from "@phosphor-icons/react/ssr";
import { govdeBloklariniAyir } from "@/lib/belgeler/resmi-belge";
import { Marker, MarkerIcon, MarkerContent } from "@/components/ui/marker";
import { Spinner } from "@/components/ui/spinner";

export interface BelgeCanliTaslakVerisi {
  belgeId: string;
  baslik: string;
  turAdi: string;
  govdeMetni: string;
  durum: "yazılıyor" | "tamam";
}

/**
 * The canvas panel's content WHILE a document is being drafted — a plain
 * writing surface, not ResmiBelgeOnizleme's stamped "T.C." letterhead, that
 * fills in as belgeTaslagiHazirla streams and ends in a blinking caret.
 * Reuses govdeBloklariniAyir so headings/lists read correctly mid-stream
 * too, without a second parser. asistan-sohbet.tsx swaps this out for the
 * real, persisted BelgeTuvali once the draft finishes and the URL catches
 * up — the final frame here matches BelgeTuvali's first frame exactly, so
 * that handoff doesn't flash.
 */
export function BelgeCanliTaslak({ taslak }: { taslak: BelgeCanliTaslakVerisi }) {
  const dipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dipRef.current?.scrollIntoView({ block: "end" });
  }, [taslak.govdeMetni]);

  const bloklar = govdeBloklariniAyir(taslak.govdeMetni);
  const yaziliyor = taslak.durum === "yazılıyor";

  const imlec = (
    <span
      aria-hidden="true"
      className="-mb-[2px] ml-0.5 inline-block h-[1em] w-[2px] animate-[belge-imlec_1s_step-end_infinite] bg-foreground align-text-bottom"
    />
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <Marker role="status">
        <MarkerIcon>
          {yaziliyor ? <Spinner /> : <CheckCircle size={16} weight="fill" className="text-success" aria-hidden="true" />}
        </MarkerIcon>
        <MarkerContent>
          {yaziliyor ? `${taslak.turAdi} taslağı hazırlanıyor…` : `${taslak.turAdi} taslağı hazır`}
        </MarkerContent>
      </Marker>

      <div className="max-h-[calc(100dvh-14rem)] flex-1 overflow-y-auto rounded-[var(--radius-card)] border border-border bg-card p-6 font-body text-sm leading-relaxed text-foreground">
        <h2 className="mb-4 text-base font-semibold text-foreground">{taslak.baslik}</h2>

        {bloklar.length === 0 && (
          <p className="italic text-muted-foreground">{yaziliyor ? "…" : "[belge gövdesi boş]"}</p>
        )}

        {bloklar.map((blok, i) => {
          const sonBlok = i === bloklar.length - 1;

          if (blok.tur === "baslik") {
            return (
              <h3 key={i} className="mb-1.5 mt-4 font-semibold text-foreground">
                {blok.metin}
                {sonBlok && yaziliyor ? imlec : null}
              </h3>
            );
          }
          if (blok.tur === "liste") {
            return (
              <ul key={i} className="mb-2 list-disc space-y-0.5 pl-5">
                {blok.ogeler.map((oge, j) => (
                  <li key={j}>
                    {oge}
                    {sonBlok && yaziliyor && j === blok.ogeler.length - 1 ? imlec : null}
                  </li>
                ))}
              </ul>
            );
          }
          return (
            <p key={i} className="mb-2">
              {blok.metin}
              {sonBlok && yaziliyor ? imlec : null}
            </p>
          );
        })}

        <div ref={dipRef} />
      </div>
    </div>
  );
}
