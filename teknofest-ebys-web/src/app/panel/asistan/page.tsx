import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { StaffShell } from "@/components/StaffShell";
import { sohbetleriListele } from "@/lib/sohbet";
import { SohbetDuzeni } from "@/components/sohbet/sohbet-duzeni";
import { AsistanSohbet } from "./asistan-sohbet";

export default async function AsistanSayfasi() {
  const session = await oturumZorunluKil();
  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, session.birimId));
  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, session.kurumId));

  const sohbetler = await sohbetleriListele({
    userId: session.userId,
    kurumId: session.kurumId,
    birimId: session.birimId,
  });

  // The id is minted here rather than on the client so an attachment can be
  // uploaded before the first message is ever sent.
  const yeniSohbetId = randomUUID();

  return (
    <StaffShell
      activeHref="/panel/asistan"
      session={{
        adSoyad: session.adSoyad,
        unvan: session.unvan,
        hiyerarsiSeviyesi: session.hiyerarsiSeviyesi,
        bilgiTabaniYonetimi: session.bilgiTabaniYonetimi,
        mevzuatYonetimi: session.mevzuatYonetimi,
        birimAdi: birim?.ad,
        kurumAdi: kurum?.ad,
      }}
    >
      <SohbetDuzeni sohbetler={sohbetler}>
        <AsistanSohbet sohbetId={yeniSohbetId} yeniMi />
      </SohbetDuzeni>
    </StaffShell>
  );
}
