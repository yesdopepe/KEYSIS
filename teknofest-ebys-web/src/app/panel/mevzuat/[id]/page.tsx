import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Scales, ArrowLeft } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { mevzuatMaddesiGetir } from "@/lib/mevzuat";
import { StaffShell } from "@/components/StaffShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * The page every mevzuat citation links to. Readable by any staff member —
 * a citation is useless if only administrators can open it — but still
 * scoped to what this institution may see.
 */
export default async function MevzuatMaddesiSayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await oturumZorunluKil();

  const madde = await mevzuatMaddesiGetir(session.kurumId, id);
  if (!madde) notFound();

  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, session.birimId));
  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, session.kurumId));

  return (
    <StaffShell
      activeHref="/panel/mevzuat"
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
          href="/panel/mevzuat"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Mevzuat külliyatı
        </Link>

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
              <Scales size={20} className="text-primary" aria-hidden="true" />
              {madde.kodu}
            </h1>
            <Badge ton={madde.kurumId === null ? "bilgi" : "notr"}>
              {madde.kurumId === null ? "Tüm kurumlar" : (kurum?.ad ?? "Bu kurum")}
            </Badge>
          </div>

          <h2 className="mt-2 text-sm font-semibold text-foreground">{madde.baslik}</h2>

          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {madde.icerik}
          </p>
        </Card>
      </main>
    </StaffShell>
  );
}
