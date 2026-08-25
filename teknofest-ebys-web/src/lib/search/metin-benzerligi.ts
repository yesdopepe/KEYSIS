/**
 * Lightweight Turkish-aware lexical similarity. Used as the fast,
 * deterministic first pass for mevzuat matching (and as a fallback when the
 * LLM call fails) — same two-stage "token score, then LLM refines" pattern
 * that worked well for classification before this rewrite, just reimplemented
 * here. No embedding model dependency required at this corpus size.
 */

const TR_STOPWORDS = new Set([
  "ve", "veya", "ile", "bir", "bu", "şu", "o", "da", "de", "ki", "mi", "mı",
  "mu", "mü", "için", "gibi", "çok", "az", "ama", "fakat", "ancak", "her",
  "ne", "ya", "olan", "olarak", "üzere", "diye", "ise", "en", "daha",
]);

/** Normalizes Turkish casing correctly (İ→i, I→ı) before lowercasing. */
export function trNormalize(text: string): string {
  return text
    .replace(/İ/g, "i")
    .replace(/I/g, "ı")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFC");
}

/** Turkish-correct uppercasing (i→İ, ı→I) — plain toUpperCase() gets this wrong. */
export function trUpper(text: string): string {
  return text.toLocaleUpperCase("tr-TR");
}

function tokenize(text: string): string[] {
  return trNormalize(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !TR_STOPWORDS.has(t));
}

/** Simple weighted token-overlap score in [0, 1]. */
export function benzerlikSkoru(sorgu: string, hedef: string): number {
  const sorguTokens = new Set(tokenize(sorgu));
  const hedefTokens = tokenize(hedef);
  if (sorguTokens.size === 0 || hedefTokens.length === 0) return 0;

  const hedefSet = new Set(hedefTokens);
  let ortak = 0;
  for (const t of sorguTokens) {
    if (hedefSet.has(t)) ortak += 1;
  }
  // Jaccard-ish: overlap relative to the smaller set, so a short target
  // (e.g. a madde title) isn't unfairly penalized against a long dilekçe.
  const payda = Math.min(sorguTokens.size, hedefSet.size);
  return payda === 0 ? 0 : ortak / payda;
}

export interface SiralanabilirAday<T> {
  aday: T;
  skor: number;
}

/** Ranks candidates by lexical similarity of `metinSecici(aday)` to `sorgu`. */
export function enIyiEslesmeler<T>(
  sorgu: string,
  adaylar: T[],
  metinSecici: (aday: T) => string,
  topK = 5
): SiralanabilirAday<T>[] {
  return adaylar
    .map((aday) => ({ aday, skor: benzerlikSkoru(sorgu, metinSecici(aday)) }))
    .sort((a, b) => b.skor - a.skor)
    .slice(0, topK);
}
