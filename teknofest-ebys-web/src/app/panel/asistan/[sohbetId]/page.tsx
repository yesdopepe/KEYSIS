import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
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
  const { belge: belgeParam } = await searchParams;
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

  // ?belge= arrives from the client, so it is resolved against this
  // conversation rather than trusted: the canvas shows a document this chat
  // produced, and nothing else. An unrelated (or another institution's) id
  // falls back to the conversation's own latest document instead of being
  // rendered.
  const [aktifBelge] = await db
    .select({ id: schema.belgeler.id, baslik: schema.belgeler.baslik })
    .from(schema.belgeler)
    .where(
      belgeParam
        ? and(eq(schema.belgeler.id, belgeParam), eq(schema.belgeler.sohbetId, sohbetId))
        : eq(schema.belgeler.sohbetId, sohbetId)
    )
    .orderBy(desc(schema.belgeler.olusturmaZamani))
    .limit(1);
  const aktifBelgeId = aktifBelge?.id;
  const belgeBasligi = aktifBelge?.baslik;

  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, session.birimId));
  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, session.kurumId));

  const [sohbetler, kayitliMesajlar, ekler] = await Promise.all([
    sohbetleriListele(sahip),
    mesajlariGetir(sahip, sohbetId),
    sohbetEkleriniListele(sahip, sohbetId),
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
          belgeId={aktifBelgeId}
          belgeBasligi={belgeBasligi}
          belgeNode={aktifBelgeId ? <BelgeTuvali belgeId={aktifBelgeId} /> : null}
        />
      </SohbetDuzeni>
    </StaffShell>
  );
}
