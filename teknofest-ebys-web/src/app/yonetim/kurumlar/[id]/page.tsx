import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Buildings } from "@phosphor-icons/react/ssr";
import { db, schema } from "@/lib/db";
import { oturumYoneticiZorunluKil } from "@/lib/auth/require-session";
import { YonetimShell } from "@/components/YonetimShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, inputClasses } from "@/components/ui/Field";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { SubmitButton } from "../../_components/submit-button";
import { kurumGuncelleAction } from "../actions";
import { YeniBirimSheet } from "./yeni-birim-sheet";

export default async function KurumDetaySayfasi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await oturumYoneticiZorunluKil();

  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, id));
  if (!kurum) notFound();

  const birimlerListesi = await db.select().from(schema.birimler).where(eq(schema.birimler.kurumId, id)).orderBy(schema.birimler.ad);

  return (
    <YonetimShell activeHref="/yonetim/kurumlar" adSoyad={session.adSoyad}>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
        <div>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href="/yonetim/kurumlar" />}>Kurumlar</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{kurum.ad}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="mt-1 flex items-center gap-2 font-heading text-xl font-semibold text-foreground">
            <Buildings size={22} className="text-primary" aria-hidden="true" />
            {kurum.ad}
          </h1>
        </div>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">Kurum bilgileri</h2>
          <form action={kurumGuncelleAction.bind(null, kurum.id)} className="mt-3 space-y-4">
            <Field label="Kurum adı" htmlFor="ad" required>
              <Input id="ad" name="ad" defaultValue={kurum.ad} required className={inputClasses} />
            </Field>
            <Field label="Haberleşme kodu" htmlFor="haberlesme_kodu" required>
              <Input id="haberlesme_kodu" name="haberlesme_kodu" defaultValue={kurum.haberlesmeKodu} required className={inputClasses} />
            </Field>
            <Field label="Açıklama" htmlFor="aciklama" hint="İsteğe bağlı; bu kurum ve genel iş alanı hakkında kısa bilgi.">
              <Textarea id="aciklama" name="aciklama" rows={3} defaultValue={kurum.aciklama ?? ""} className={inputClasses} />
            </Field>
            <SubmitButton variant="outline">Değişiklikleri Kaydet</SubmitButton>
          </form>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 p-5 pb-0">
            <h2 className="text-sm font-semibold text-foreground">Birimler ({birimlerListesi.length})</h2>
            <YeniBirimSheet kurumId={kurum.id} birimlerListesi={birimlerListesi} />
          </div>
          {birimlerListesi.length === 0 ? (
            <Empty className="border-none">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Buildings size={20} aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Henüz birim yok</EmptyTitle>
                <EmptyDescription>“Birim Ekle” ile bu kuruma ilk birimi tanımlayın.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Birim adı</TableHead>
                  <TableHead>Kod</TableHead>
                  <TableHead>Açıklama</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {birimlerListesi.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-normal font-medium text-foreground">
                      <Link href={`/yonetim/birimler?id=${encodeURIComponent(b.id)}`} className="hover:text-primary hover:underline">
                        {b.ad}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{b.kod}</TableCell>
                    <TableCell className="text-muted-foreground">{b.aciklama ? "açıklaması var" : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </main>
    </YonetimShell>
  );
}
