/**
 * Export format constants. Deliberately free of any renderer import: the
 * download buttons render inside client components, and pulling the format
 * list from the same module as the renderers would drag docx/react-pdf (and
 * their `server-only` guards) into the browser bundle.
 */
export const BELGE_FORMATLARI = ["pdf", "docx", "udf"] as const;
export type BelgeFormati = (typeof BELGE_FORMATLARI)[number];

export const BELGE_MIME: Record<BelgeFormati, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // UYAP's own format has no registered IANA type; it is a ZIP container.
  udf: "application/octet-stream",
};

export function formatCoz(deger: string | null): BelgeFormati | null {
  return BELGE_FORMATLARI.includes(deger as BelgeFormati) ? (deger as BelgeFormati) : null;
}
