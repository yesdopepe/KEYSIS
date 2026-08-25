import "server-only";
import { customAlphabet } from "nanoid";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// No ambiguous chars (0/O, 1/I) — this code gets read aloud/typed by citizens.
const takipNoUret = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

export function yeniTakipNo(): string {
  return takipNoUret();
}

/**
 * SDP-style internal registry number: haberleşme_kodu-sdp_kodu/sıra_no.
 * The sequence number comes from a single atomic upsert (insert-or-
 * increment-and-return) — not a separate SELECT count() followed by an
 * INSERT — so two submissions racing for the same kurum can never be
 * handed the same number.
 */
export async function yeniKayitNo(kurumId: string, sdpKodu: string): Promise<string> {
  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, kurumId));

  const [{ sonSayac }] = await db
    .insert(schema.evrakSayaclari)
    .values({ kurumId, sonSayac: 1001 })
    .onConflictDoUpdate({
      target: schema.evrakSayaclari.kurumId,
      set: { sonSayac: sql`${schema.evrakSayaclari.sonSayac} + 1` },
    })
    .returning({ sonSayac: schema.evrakSayaclari.sonSayac });

  const haberlesmeKodu = kurum?.haberlesmeKodu ?? "GENEL";
  return `${haberlesmeKodu}-${sdpKodu || "000.00"}/${sonSayac}`;
}
