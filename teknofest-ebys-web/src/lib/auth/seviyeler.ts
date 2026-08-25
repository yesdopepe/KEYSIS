/**
 * Hierarchy level thresholds. Kept in a plain module rather than beside the
 * server actions that enforce them, because a "use server" file may only
 * export async functions — and UI code needs to read these to decide what to
 * offer (the actions still re-check server-side; this is only for display).
 */
export const HIYERARSI = {
  memur: 1,
  subeMuduru: 2,
  daireBaskani: 3,
} as const;

/** Curating the institution knowledge base shapes what the assistant answers. */
export const BILGI_TABANI_MIN_SEVIYE = HIYERARSI.daireBaskani;

/**
 * Mevzuat is the legal basis every draft cites, and an entry marked "tüm
 * kurumlar" is visible to every institution — so curating it sits at the
 * same level as the knowledge base.
 */
export const MEVZUAT_MIN_SEVIYE = HIYERARSI.daireBaskani;
