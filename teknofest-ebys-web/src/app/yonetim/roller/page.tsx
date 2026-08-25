import { UsersThree } from "@phosphor-icons/react/ssr";
import { db, schema } from "@/lib/db";
import { oturumYoneticiZorunluKil } from "@/lib/auth/require-session";
import { YonetimShell } from "@/components/YonetimShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { RolDialog } from "./rol-dialog";
import { RolSilButton } from "./rol-sil-button";

const SEVIYE_ETIKETLERI: Record<number, string> = {
  1: "1 — Memur",
  2: "2 — Şube Müdürü",
  3: "3 — Daire Başkanı",
};

export default async function RollerSayfasi() {
  const session = await oturumYoneticiZorunluKil();
  const rollerListesi = await db.select().from(schema.roller).orderBy(schema.roller.ad);

  return (
    <YonetimShell activeHref="/yonetim/roller" adSoyad={session.adSoyad}>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-heading text-xl font-semibold text-foreground">
              <UsersThree size={22} className="text-primary" aria-hidden="true" />
              Roller
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bir rolü düzenlemek, ona atanmış her kullanıcının onay seviyesini ve unvanını da günceller.
            </p>
          </div>
          <RolDialog />
        </div>

        <Card className="overflow-hidden p-0">
          {rollerListesi.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <UsersThree size={20} aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Henüz rol yok</EmptyTitle>
                <EmptyDescription>Başlamak için “Yeni Rol” ile ilk rolü ekleyin.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rol adı</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead>Onay seviyesi</TableHead>
                  <TableHead>İzinler</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rollerListesi.map((rol) => (
                  <TableRow key={rol.id}>
                    <TableCell className="font-medium text-foreground">{rol.ad}</TableCell>
                    <TableCell className="whitespace-normal text-muted-foreground">{rol.aciklama || "—"}</TableCell>
                    <TableCell>
                      {rol.onaySeviyesi != null ? (
                        <Badge ton="bilgi">{SEVIYE_ETIKETLERI[rol.onaySeviyesi] ?? rol.onaySeviyesi}</Badge>
                      ) : (
                        <Badge ton="notr">Onaylamaz</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {rol.mevzuatYonetimi && <Badge ton="basari">Mevzuat</Badge>}
                        {rol.bilgiTabaniYonetimi && <Badge ton="basari">Bilgi tabanı</Badge>}
                        {!rol.mevzuatYonetimi && !rol.bilgiTabaniYonetimi && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <RolDialog rol={rol} />
                        <RolSilButton rolId={rol.id} rolAdi={rol.ad} />
                      </div>
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
