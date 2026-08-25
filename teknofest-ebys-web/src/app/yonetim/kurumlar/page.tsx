import Link from "next/link";
import { Buildings } from "@phosphor-icons/react/ssr";
import { db, schema } from "@/lib/db";
import { oturumYoneticiZorunluKil } from "@/lib/auth/require-session";
import { YonetimShell } from "@/components/YonetimShell";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { YeniKurumDialog } from "./yeni-kurum-dialog";

export default async function KurumlarSayfasi() {
  const session = await oturumYoneticiZorunluKil();
  const kurumlar = await db.select().from(schema.kurumlar).orderBy(schema.kurumlar.ad);

  return (
    <YonetimShell activeHref="/yonetim/kurumlar" adSoyad={session.adSoyad}>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-xl font-semibold text-foreground">
              <Buildings size={22} className="text-primary" aria-hidden="true" />
              Kurumlar
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bir kurumun birimlerini, açıklamasını ve kullanıcılarını yönetmek için kurum adına tıklayın.
            </p>
          </div>
          <YeniKurumDialog />
        </div>

        <Card className="overflow-hidden p-0">
          {kurumlar.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Buildings size={20} aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Henüz kurum yok</EmptyTitle>
                <EmptyDescription>Başlamak için “Yeni Kurum” ile ilk kurumu ekleyin.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kurum adı</TableHead>
                  <TableHead>Haberleşme kodu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kurumlar.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="whitespace-normal font-medium text-foreground">
                      <Link href={`/yonetim/kurumlar/${k.id}`} className="hover:text-primary hover:underline">
                        {k.ad}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{k.haberlesmeKodu}</TableCell>
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
