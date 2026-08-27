"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A4 width in CSS pixels at 96dpi — the natural width of every paper sheet we render. */
const A4_GENISLIK_PX = 794;

export interface BelgeSayfaCercevesiProps {
  children: ReactNode;
  /** Never shrink below this, even in a very narrow column — scroll instead. */
  enKucukOlcek?: number;
  className?: string;
}

/**
 * Fits an A4 sheet into whatever width it is given. The sheet keeps its
 * real 210mm geometry (so margins, indents and line breaks match the PDF
 * export) and is scaled down as a whole, the way a print preview does it —
 * rather than being squeezed into a horizontally scrolling box, which is
 * what a raw `overflow-x-auto` around a 794px page produces in a half-width
 * column.
 *
 * `transform: scale()` does not affect layout, so the wrapper's height is
 * set from the measured sheet height: without that the scaled page would
 * leave a page-sized gap underneath it.
 */
export function BelgeSayfaCercevesi({
  children,
  enKucukOlcek = 0.5,
  className,
}: BelgeSayfaCercevesiProps) {
  const kapsayiciRef = useRef<HTMLDivElement>(null);
  const sayfaRef = useRef<HTMLDivElement>(null);
  const [olcek, setOlcek] = useState(1);
  const [yukseklik, setYukseklik] = useState<number | undefined>(undefined);

  const olc = useCallback(() => {
    const kapsayici = kapsayiciRef.current;
    const sayfa = sayfaRef.current;
    if (!kapsayici || !sayfa) return;

    const mevcut = kapsayici.clientWidth;
    const yeniOlcek = Math.max(enKucukOlcek, Math.min(1, mevcut / A4_GENISLIK_PX));
    setOlcek(yeniOlcek);
    setYukseklik(sayfa.offsetHeight * yeniOlcek);
  }, [enKucukOlcek]);

  useEffect(() => {
    olc();
    const kapsayici = kapsayiciRef.current;
    const sayfa = sayfaRef.current;
    if (!kapsayici || !sayfa) return;

    // Both edges matter: the container width drives the scale, and the sheet's
    // own height changes whenever the body text does (edit, accepted revision).
    const gozlemci = new ResizeObserver(olc);
    gozlemci.observe(kapsayici);
    gozlemci.observe(sayfa);
    return () => gozlemci.disconnect();
  }, [olc]);

  return (
    <div
      ref={kapsayiciRef}
      className={cn("w-full overflow-x-auto", className)}
      style={{ height: yukseklik }}
    >
      <div
        ref={sayfaRef}
        style={{
          width: A4_GENISLIK_PX,
          transform: olcek === 1 ? undefined : `scale(${olcek})`,
          transformOrigin: "top left",
          // Only meaningful at full size, where the sheet is narrower than
          // its container; a scaled sheet already fills the width exactly.
          marginInline: olcek === 1 ? "auto" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
