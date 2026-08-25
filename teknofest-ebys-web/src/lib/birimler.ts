import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Keeps a birim's catch-all yazışma şablonu in sync with its aciklama.
 * pipeline.ts's sablonGetir throws if a classified evrakTuruId has no
 * matching row, so a birim with no hand-authored template is otherwise
 * unreachable by the router — this is what makes an admin-written
 * description actually routable, not just documentation. Reuses the
 * existing template/candidate/pipeline mechanism unchanged: a deterministic
 * id keeps re-saving the description an update rather than a duplicate, and
 * clearing the description deletes the row so a department an admin no
 * longer wants as a catch-all target stops silently absorbing submissions.
 */
export async function birimGenelSablonunuGuncelle(birim: {
  id: string;
  kurumId: string;
  kod: string;
  ad: string;
  aciklama: string | null;
}): Promise<void> {
  const sablonId = `genel_${birim.id}`;

  if (!birim.aciklama?.trim()) {
    await db.delete(schema.yazismaSablonlari).where(eq(schema.yazismaSablonlari.id, sablonId));
    return;
  }

  const ad = `${birim.ad} - Genel Başvuru`;
  const taslakKurallari =
    `${birim.aciklama.trim()}\n\n` +
    `Cevap yazısı; başvurunun alındığını ve ${birim.ad}'ne iletildiğini belirtmeli, ` +
    `resmi ve kısa bir üslupla yazılmalı.`;

  await db
    .insert(schema.yazismaSablonlari)
    .values({
      id: sablonId,
      kurumId: birim.kurumId,
      evrakTuru: "genel_basvuru",
      ad,
      ilgiliBirimKodu: birim.kod,
      gerekliAlanlar: "[]",
      taslakKurallari,
    })
    .onConflictDoUpdate({
      target: schema.yazismaSablonlari.id,
      set: { ad, ilgiliBirimKodu: birim.kod, kurumId: birim.kurumId, taslakKurallari },
    });
}
