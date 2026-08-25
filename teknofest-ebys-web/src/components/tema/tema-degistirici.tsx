"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Sun, Moon, Desktop } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import {
  koyuMu,
  sunucuTemasi,
  temayaAbone,
  temayiOku,
  temayiYaz,
  type Tema,
} from "@/lib/tema";

const SECENEKLER: { deger: Tema; etiket: string; Ikon: typeof Sun }[] = [
  { deger: "acik", etiket: "Açık tema", Ikon: Sun },
  { deger: "koyu", etiket: "Koyu tema", Ikon: Moon },
  { deger: "sistem", etiket: "Sistem teması", Ikon: Desktop },
];

/**
 * Segmented light/dark/system control. It toggles the same `dark` class on
 * <html> that the inline head script sets (see lib/tema.ts) — the script owns
 * the first paint, this component takes over once React is running.
 */
export function TemaDegistirici({ className }: { className?: string }) {
  const tema = useSyncExternalStore(temayaAbone, temayiOku, sunucuTemasi);

  // useLayoutEffect, not useEffect, for two reasons. It runs before paint, so
  // there is no flash between hydration and the class landing. And in dev,
  // React's Strict Mode remount resets <html> to only the attributes it
  // manages from JSX — wiping the class the head script set — so re-applying
  // here is what keeps the dev experience matching production.
  useLayoutEffect(() => {
    const sorgu = window.matchMedia("(prefers-color-scheme: dark)");
    const uygula = () =>
      document.documentElement.classList.toggle("dark", koyuMu(tema, sorgu.matches));

    uygula();
    // Only "sistem" tracks the OS; the explicit choices stay pinned.
    if (tema !== "sistem") return;
    sorgu.addEventListener("change", uygula);
    return () => sorgu.removeEventListener("change", uygula);
  }, [tema]);

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={cn(
        "flex items-center gap-0.5 rounded-[var(--radius-control)] border border-border bg-card p-0.5",
        className
      )}
    >
      {SECENEKLER.map(({ deger, etiket, Ikon }) => {
        const secili = tema === deger;
        return (
          <button
            key={deger}
            type="button"
            role="radio"
            aria-checked={secili}
            aria-label={etiket}
            title={etiket}
            onClick={() => temayiYaz(deger)}
            className={cn(
              "flex h-8 flex-1 cursor-pointer items-center justify-center rounded-[calc(var(--radius-control)-2px)] transition-colors",
              secili
                ? "bg-info-bg text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Ikon size={15} weight={secili ? "fill" : "regular"} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
