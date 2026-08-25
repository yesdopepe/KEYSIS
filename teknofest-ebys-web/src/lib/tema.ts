export type Tema = "acik" | "koyu" | "sistem";

export const TEMA_ANAHTARI = "eb-tema";

/** "sistem" follows the OS setting; the two explicit choices pin it. */
export const VARSAYILAN_TEMA: Tema = "sistem";

export function koyuMu(tema: Tema, sistemKoyu: boolean): boolean {
  return tema === "koyu" || (tema === "sistem" && sistemKoyu);
}

/**
 * Inlined into <head> so the `dark` class lands on <html> before the first
 * paint. Without it every server-rendered navigation flashes the light
 * palette for a frame before hydration catches up — the one bit of theming
 * that genuinely cannot wait for React.
 *
 * Deliberately ES5 and wrapped in try/catch: it runs ahead of the bundle and
 * outside any error boundary, and `localStorage` alone throws in a browser
 * with site data blocked. A failure here must leave the default light theme
 * standing, never an unstyled page.
 */
export const TEMA_ON_YUKLEME_SCRIPTI = `(function(){try{
var t=localStorage.getItem(${JSON.stringify(TEMA_ANAHTARI)})||${JSON.stringify(VARSAYILAN_TEMA)};
var k=t==="koyu"||(t==="sistem"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",k);
}catch(e){}})();`;

// --- Client-side store -----------------------------------------------------
// localStorage is an external store, so the toggle reads it through
// useSyncExternalStore rather than copying it into state from an effect.
// That also gets the hydration handling for free: React renders the server
// snapshot first, then swaps to the real one without reporting a mismatch.

const dinleyiciler = new Set<() => void>();

export function temayaAbone(dinleyici: () => void): () => void {
  dinleyiciler.add(dinleyici);
  // "storage" only fires in the *other* tabs, which is exactly what it is
  // for here — same-tab writes notify through temayiYaz below.
  window.addEventListener("storage", dinleyici);
  return () => {
    dinleyiciler.delete(dinleyici);
    window.removeEventListener("storage", dinleyici);
  };
}

export function temayiOku(): Tema {
  try {
    return (window.localStorage.getItem(TEMA_ANAHTARI) as Tema | null) ?? VARSAYILAN_TEMA;
  } catch {
    return VARSAYILAN_TEMA;
  }
}

/** The server has no storage to read, so the default is all it can claim. */
export function sunucuTemasi(): Tema {
  return VARSAYILAN_TEMA;
}

export function temayiYaz(tema: Tema): void {
  try {
    window.localStorage.setItem(TEMA_ANAHTARI, tema);
  } catch {
    // Site data blocked — the choice still holds for this page's lifetime.
  }
  dinleyiciler.forEach((dinleyici) => dinleyici());
}
