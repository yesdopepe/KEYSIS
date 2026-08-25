import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { StaffShell } from "@/components/StaffShell";
import { BelgeTuvali } from "@/components/belge/BelgeTuvali";

/**
 * Standalone document page — reachable from "Belgelerim" for documents made
 * before the chat era, or from a chat whose conversation has since been
 * deleted. Creation and day-to-day editing now happen in the chat's canvas
 * (/panel/asistan/[sohbetId]?belge=...), which renders the exact same
 * BelgeTuvali; this route exists so a belge is never orphaned without a way
 * to view or act on it.
 */
export default async function BelgeDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await oturumZorunluKil();

  const [belge] = await db.select({ id: schema.belgeler.id }).from(schema.belgeler).where(eq(schema.belgeler.id, id));
  if (!belge) notFound();

  const [sessionBirim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, session.birimId));
  const [sessionKurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, session.kurumId));

  return (
    <StaffShell
      activeHref="/panel/belge"
      session={{
        adSoyad: session.adSoyad,
        unvan: session.unvan,
        hiyerarsiSeviyesi: session.hiyerarsiSeviyesi,
        bilgiTabaniYonetimi: session.bilgiTabaniYonetimi,
        mevzuatYonetimi: session.mevzuatYonetimi,
        birimAdi: sessionBirim?.ad,
        kurumAdi: sessionKurum?.ad,
      }}
    >
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <BelgeTuvali belgeId={id} />
      </main>
    </StaffShell>
  );
}
