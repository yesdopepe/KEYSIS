import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { UsersThree } from "@phosphor-icons/react/ssr";
import { db, schema } from "@/lib/db";
import { oturumYoneticiZorunluKil } from "@/lib/auth/require-session";
import { YonetimShell } from "@/components/YonetimShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "../_components/submit-button";
import { BirimBilgileriForm } from "./birim-bilgileri-form";
import { YeniKullaniciSheet } from "./yeni-kullanici-sheet";
import { kullaniciRolGuncelleAction } from "./actions";

// Birim ids contain a colon (kurumId:kod), which Next.js rejects as a plain
// [id] path segment — a query param has no such restriction, so this page
// reads ?id= instead of a dynamic segment. See kurumlar/[id]/page.tsx's link.
export default async function BirimDetaySayfasi({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const session = await oturumYoneticiZorunluKil();

  if (!id) notFound();
  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, id));
  if (!birim) notFound();

  const [kurum, digerBirimler, roller, kullanicilar] = await Promise.all([
    db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, birim.kurumId)).then((r) => r[0]),
    db.select().from(schema.birimler).where(eq(schema.birimler.kurumId, birim.kurumId)),
    db.select().from(schema.roller).orderBy(schema.roller.ad),
    db.select().from(schema.kullanicilar).where(eq(schema.kullanicilar.birimId, id)).orderBy(schema.kullanicilar.adSoyad),
  ]);

  const secilenSeviyeler: number[] = JSON.parse(birim.onayZinciriSeviyeleri);
  const ustBirimAdaylari = digerBirimler.filter((b) => b.id !== birim.id);

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
              {kurum && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink render={<Link href={`/yonetim/kurumlar/${kurum.id}`} />}>{kurum.ad}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage>{birim.ad}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="mt-1 font-heading text-xl font-semibold text-foreground">{birim.ad}</h1>
        </div>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">Birim bilgileri</h2>
          <BirimBilgileriForm birim={birim} ustBirimAdaylari={ustBirimAdaylari} secilenSeviyeler={secilenSeviyeler} />
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 p-5 pb-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <UsersThree size={17} className="text-primary" aria-hidden="true" />
              Kullanıcılar ({kullanicilar.length})
            </h2>
            <YeniKullaniciSheet kurumId={birim.kurumId} birimId={birim.id} roller={roller} />
          </div>
          {kullanicilar.length === 0 ? (
            <Empty className="border-none">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersThree size={20} aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Bu birimde henüz kullanıcı yok</EmptyTitle>
                <EmptyDescription>“Kullanıcı Ekle” ile bu birime ilk personeli tanımlayın.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table className="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>Kullanıcı adı</TableHead>
                  <TableHead>Unvan / Seviye</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">Rol</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kullanicilar.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium text-foreground">{k.adSoyad}</TableCell>
                    <TableCell className="text-muted-foreground">{k.kullaniciAdi}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {k.unvan} · seviye {k.hiyerarsiSeviyesi}
                    </TableCell>
                    <TableCell>
                      {k.aktifMi ? <Badge ton="basari">Aktif</Badge> : <Badge ton="tehlike">Devre dışı</Badge>}
                    </TableCell>
                    <TableCell>
                      <form
                        action={kullaniciRolGuncelleAction.bind(null, k.id, birim.id)}
                        className="flex items-center justify-end gap-2"
                      >
                        <Select
                          name="rol_id"
                          defaultValue={k.rolId ?? undefined}
                          items={Object.fromEntries(roller.map((r) => [r.id, r.ad]))}
                        >
                          <SelectTrigger size="sm" className="w-40 justify-between bg-card font-normal">
                            <SelectValue placeholder="Rol seç" />
                          </SelectTrigger>
                          <SelectContent>
                            {roller.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.ad}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <SubmitButton variant="outline" size="sm">
                          Ata
                        </SubmitButton>
                      </form>
                    </TableCell>
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
