import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import type { UIMessage } from "ai";
import { db, schema } from "@/lib/db";
import { PublicShell } from "@/components/PublicShell";
import {
  mesajlariGetir,
  sohbetEkleriniListele,
  sohbetGetir,
  sohbetleriListele,
} from "@/lib/sohbet";
import { BelgeTuvali } from "@/components/belge/BelgeTuvali";
import { SohbetDuzeni } from "@/components/sohbet/sohbet-duzeni";
import { AsistanSohbet, type YuklenenEk } from "@/app/panel/asistan/asistan-sohbet";

export const metadata = {
  title: "Dilekçe & Kurum Danışmanı Asistanı | e-Başvuru",
};

export default async function VatandasSohbetSayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ sohbetId: string }>;
  searchParams: Promise<{ belge?: string }>;
}) {
  const { sohbetId } = await params;
  const { belge: belgeParam } = await searchParams;

  const sahip = {
    userId: "u_vatandas",
    kurumId: "belediye_ornek",
    birimId: "belediye_ornek:YZI",
  };

  const sohbet = await sohbetGetir(sahip, sohbetId);
  if (!sohbet) notFound();

  // Same reasoning as the staff page: ?belge= is client input, so it only
  // resolves within this conversation's own documents — otherwise any belge
  // id typed into the URL would render a staff document in the citizen canvas.
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
    <PublicShell activeHref="/basvuru/asistan">
      <div className="h-[calc(100dvh-4rem)] w-full">
        <SohbetDuzeni
          sohbetler={sohbetler}
          aktifId={sohbetId}
          baslik={sohbet.baslik || "Dilekçe & Kurum Danışmanı Asistanı"}
          baseHref="/basvuru/asistan"
        >
          <AsistanSohbet
            sohbetId={sohbetId}
            baslangicMesajlari={baslangicMesajlari}
            baslangicEkleri={baslangicEkleri}
            yeniMi={false}
            baseHref="/basvuru/asistan"
            belgeId={aktifBelgeId}
            belgeBasligi={belgeBasligi}
            belgeNode={aktifBelgeId ? <BelgeTuvali belgeId={aktifBelgeId} /> : null}
          />
        </SohbetDuzeni>
      </div>
    </PublicShell>
  );
}
