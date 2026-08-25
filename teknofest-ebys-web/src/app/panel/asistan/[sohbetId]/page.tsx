import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { StaffShell } from "@/components/StaffShell";
import {
  mesajlariGetir,
  sohbetEkleriniListele,
  sohbetGetir,
  sohbetleriListele,
} from "@/lib/sohbet";
import { BelgeTuvali } from "@/components/belge/BelgeTuvali";
import { SohbetDuzeni } from "@/components/sohbet/sohbet-duzeni";
import { AsistanSohbet, type YuklenenEk } from "../asistan-sohbet";

export default async function SohbetSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ sohbetId: string }>;
  searchParams: Promise<{ belge?: string }>;
}) {
  const { sohbetId } = await params;
  const { belge: belgeId } = await searchParams;
  const session = await oturumZorunluKil();

  const sahip = {
    userId: session.userId,
    kurumId: session.kurumId,
    birimId: session.birimId,
  };

  // Resolved by (id, owner, kurum) together — another user's chat is simply
  // not found rather than forbidden, so ids stay unguessable.
  const sohbet = await sohbetGetir(sahip, sohbetId);
  if (!sohbet) notFound();

  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, session.birimId));
  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, session.kurumId));

  const [sohbetler, kayitliMesajlar, ekler, belgeBasligi] = await Promise.all([
    sohbetleriListele(sahip),
    mesajlariGetir(sahip, sohbetId),
    sohbetEkleriniListele(sahip, sohbetId),
    belgeId
      ? db
          .select({ baslik: schema.belgeler.baslik })
          .from(schema.belgeler)
          .where(eq(schema.belgeler.id, belgeId))
          .then((r) => r[0]?.baslik)
      : Promise.resolve(undefined),
  ]);

  const baslangicMesajlari = kayitliMesajlar.map((m) => ({
    id: m.id,
    role: m.rol,
    parts: m.parcalar,
  })) as UIMessage[];

  const baslangicEkleri: YuklenenEk[] = ekler.map((ek) => ({
    id: ek.id,
    ad: ek.ad,
    tur: ek.tur as "gorsel" | "belge",
    mimeTur: ek.mimeTur,
    url: `/api/sohbet/${sohbetId}/ek/${ek.id}`,
  }));

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
      <SohbetDuzeni sohbetler={sohbetler} aktifId={sohbetId} baslik={sohbet.baslik}>
        <AsistanSohbet
          sohbetId={sohbetId}
          baslangicMesajlari={baslangicMesajlari}
          baslangicEkleri={baslangicEkleri}
          yeniMi={false}
          belgeId={belgeId}
          belgeBasligi={belgeBasligi}
          belgeNode={belgeId ? <BelgeTuvali belgeId={belgeId} /> : null}
        />
      </SohbetDuzeni>
    </StaffShell>
  );
}
