import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Assigns a role, denormalizing its onaySeviyesi/ad onto the user's
 * hiyerarsiSeviyesi/unvan columns — every existing consumer of those two
 * columns (approval-chain gating, document-type gating, display) keeps
 * reading them exactly as before, now just sourced from a role.
 * onaySeviyesi null (a role that never approves anything) falls back to 1,
 * since hiyerarsiSeviyesi itself stays not-null.
 */
export async function kullaniciRolAta(kullaniciId: string, rolId: string): Promise<void> {
  const [rol] = await db.select().from(schema.roller).where(eq(schema.roller.id, rolId));
  if (!rol) throw new Error("Rol bulunamadı.");

  await db
    .update(schema.kullanicilar)
    .set({ rolId, hiyerarsiSeviyesi: rol.onaySeviyesi ?? 1, unvan: rol.ad })
    .where(eq(schema.kullanicilar.id, kullaniciId));
}

/**
 * Re-applies a role's current onaySeviyesi/ad to every user already
 * assigned to it. Required after every role edit — hiyerarsiSeviyesi/unvan
 * are copied at assignment time, not read live, so without this an edited
 * role silently drifts out of sync with users assigned before the edit.
 */
export async function rolDegisikliginiYay(rolId: string): Promise<void> {
  const [rol] = await db.select().from(schema.roller).where(eq(schema.roller.id, rolId));
  if (!rol) return;

  await db
    .update(schema.kullanicilar)
    .set({ hiyerarsiSeviyesi: rol.onaySeviyesi ?? 1, unvan: rol.ad })
    .where(eq(schema.kullanicilar.rolId, rolId));
}
