import "server-only";
import { cookies } from "next/headers";

const VATANDAS_SOHBETLER_COOKIE = "ebys_vatandas_sohbetler";
const COOKIE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Returns the list of conversation IDs that belong to the current
 * anonymous citizen browser session.
 */
export async function getVatandasSohbetIdleri(): Promise<string[]> {
  try {
    const store = await cookies();
    const raw = store.get(VATANDAS_SOHBETLER_COOKIE)?.value;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Registers a conversation ID into the citizen's browser session.
 */
export async function vatandasSohbetiEkle(sohbetId: string): Promise<void> {
  try {
    const store = await cookies();
    const mevcut = await getVatandasSohbetIdleri();
    if (mevcut.includes(sohbetId)) return;
    const guncel = [sohbetId, ...mevcut].slice(0, 50);
    store.set(VATANDAS_SOHBETLER_COOKIE, JSON.stringify(guncel), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_TTL_SECONDS,
      path: "/",
    });
  } catch {
    // In read-only contexts, ignore cookie set errors gracefully
  }
}

/**
 * Removes a conversation ID from the citizen's browser session.
 */
export async function vatandasSohbetiKaldir(sohbetId: string): Promise<void> {
  try {
    const store = await cookies();
    const mevcut = await getVatandasSohbetIdleri();
    const guncel = mevcut.filter((id) => id !== sohbetId);
    store.set(VATANDAS_SOHBETLER_COOKIE, JSON.stringify(guncel), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_TTL_SECONDS,
      path: "/",
    });
  } catch {
    // In read-only contexts, ignore cookie set errors gracefully
  }
}
