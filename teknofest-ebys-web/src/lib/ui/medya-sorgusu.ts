"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query from React.
 *
 * Reach for this only when the two branches must not both exist in the DOM —
 * duplicated form controls, duplicated ids, a second copy of a subscription.
 * Anything that is purely a matter of appearance belongs in a Tailwind
 * responsive variant instead, which costs no JavaScript and is right on the
 * very first paint.
 *
 * `sunucuVarsayilani` is what the server renders, since it has no viewport to
 * measure. A client whose real answer differs re-renders once — no hydration
 * error, because useSyncExternalStore is built to hand over exactly this way.
 */
export function useMedyaSorgusu(sorgu: string, sunucuVarsayilani: boolean): boolean {
  const abone = useCallback(
    (dinleyici: () => void) => {
      const liste = window.matchMedia(sorgu);
      liste.addEventListener("change", dinleyici);
      return () => liste.removeEventListener("change", dinleyici);
    },
    [sorgu]
  );

  return useSyncExternalStore(
    abone,
    () => window.matchMedia(sorgu).matches,
    () => sunucuVarsayilani
  );
}
