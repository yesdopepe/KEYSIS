import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Books, ArrowLeft } from "@phosphor-icons/react/ssr";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { kurumBelgesiGetir } from "@/lib/bilgi-tabani";
import { StaffShell } from "@/components/StaffShell";
import { Card } from "@/components/ui/card";

/**
 * The page a knowledge-base citation links to. Chunks are shown in order and
 * numbered to match the "parça n" the assistant cites, so a reader can find
 * the exact passage an answer came from.
 */
export default async function KurumBelgesiSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await oturumZorunluKil();

  const sonuc = await kurumBelgesiGetir(session.kurumId, id);
  if (!sonuc) notFound();

  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, session.birimId));
  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, session.kurumId));

  return (
    <StaffShell
      activeHref="/panel/kurum-belgeleri"
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
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
        <Link
          href="/panel/kurum-belgeleri"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Kurum bilgi tabanı
        </Link>

        <Card className="p-6">
          <h1 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <Books size={20} className="text-primary" aria-hidden="true" />
            {sonuc.belge.ad}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {sonuc.belge.dosyaAdi ? `${sonuc.belge.dosyaAdi} · ` : ""}
            {sonuc.parcalar.length} parça ·{" "}
            {sonuc.belge.olusturmaZamani.toLocaleDateString("tr-TR")}
          </p>
        </Card>

        {sonuc.parcalar.map((p) => (
          <Card key={p.sira} className="p-5">
            <p className="text-xs font-semibold text-muted-foreground">Parça {p.sira + 1}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {p.metin}
            </p>
          </Card>
        ))}
      </main>
    </StaffShell>
  );
}
