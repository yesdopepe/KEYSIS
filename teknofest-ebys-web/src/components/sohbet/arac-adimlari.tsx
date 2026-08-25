"use client";

import { CaretRight, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface AracAdimi {
  anahtar: string;
  ad: string;
  Ikon: typeof MagnifyingGlass;
  /** Follow-up link the tool result exposed, when it has one. */
  baglanti: string | null;
  tamamlandiMi: boolean;
}

function AdimSatiri({ adim }: { adim: AracAdimi }) {
  const { Ikon, ad, baglanti, tamamlandiMi } = adim;
  return (
    <div className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
      <Ikon size={14} className="shrink-0" aria-hidden="true" />
      <span className={tamamlandiMi ? undefined : "shimmer"}>{ad}</span>
      {baglanti && (
        <Link
          href={baglanti}
          className="font-medium text-primary underline underline-offset-2"
        >
          Aç
        </Link>
      )}
    </div>
  );
}

/**
 * The work an assistant turn did before answering, shown the way a reader
 * actually wants it: one quiet summary line by default, the individual steps
 * only if they ask. Rendering every tool call as its own badge (the previous
 * behaviour) buried the answer under process on any turn that used more than
 * one or two tools.
 *
 * A single step needs no disclosure — it *is* the summary — so it renders as
 * a plain row and skips the collapsible entirely.
 */
export function AracAdimlari({ adimlar }: { adimlar: AracAdimi[] }) {
  if (adimlar.length === 0) return null;
  if (adimlar.length === 1) {
    return (
      <div className="mb-1">
        <AdimSatiri adim={adimlar[0]} />
      </div>
    );
  }

  const suranAdim = adimlar.find((a) => !a.tamamlandiMi);
  const ozet = suranAdim ? suranAdim.ad : `${adimlar.length} işlem yapıldı`;

  return (
    <Collapsible className="mb-1">
      <CollapsibleTrigger className="group/adimlar flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-control)] py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <CaretRight
          size={12}
          className="shrink-0 transition-transform group-data-[panel-open]/adimlar:rotate-90"
          aria-hidden="true"
        />
        <span className={suranAdim ? "shimmer" : undefined}>{ozet}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="ps-[1.125rem]">
        {adimlar.map((adim) => (
          <AdimSatiri key={adim.anahtar} adim={adim} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
