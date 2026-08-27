import "server-only";
import type { SessionPayload } from "@/lib/auth/session";

/**
 * Who may *read* a belge.
 *
 * Until now only the write paths checked ownership (belgeYetkiKontrol in
 * panel/belge/actions.ts); every read path — BelgeTuvali, the standalone
 * /panel/belge/[id] page and the belgeDetayGetirAction Server Action —
 * resolved a belge by its id alone, so any logged-in user who knew (or was
 * handed) an id could read another institution's document in full. `yetkili`
 * only ever gated the *buttons*, not the text.
 *
 * The rule mirrors belgeYetkiKontrol exactly, so read and write agree:
 * a belge belongs to its birim, plus the one citizen-facing exception for
 * dilekçe drafted through /basvuru/asistan (no session there — see the
 * vatandaş fallback in panel/belge/actions.ts).
 */

export interface BelgeErisimKaydi {
  belgeTuru: string;
  birimId: string;
  olusturanKullaniciId: string;
}

type ErisimOturumu = Pick<SessionPayload, "birimId" | "hiyerarsiSeviyesi"> | null;

/** A dilekçe drafted by the citizen assistant, which has no real session. */
export function vatandasBelgesiMi(belge: BelgeErisimKaydi): boolean {
  return belge.olusturanKullaniciId === "u_vatandas" || belge.belgeTuru === "dilekce";
}

/**
 * `session` is null for an unauthenticated citizen — they reach only their
 * own dilekçe, never a staff document. A staff member reads what their own
 * birim owns; a havale moves the belge and its readership together, which is
 * what makes the receiving birim able to act on it.
 */
export function belgeyiOkuyabilirMi(belge: BelgeErisimKaydi, session: ErisimOturumu): boolean {
  // Citizen documents (dilekçe) can be read by citizens and reviewing staff alike
  if (vatandasBelgesiMi(belge)) return true;
  if (!session) return false;
  return belge.birimId === session.birimId;
}
