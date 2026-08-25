import Link from "next/link";
import { count } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { oturumYoneticiZorunluKil } from "@/lib/auth/require-session";
import { YonetimShell } from "@/components/YonetimShell";
import { Card } from "@/components/ui/card";

export default async function YonetimSayfasi() {
  const session = await oturumYoneticiZorunluKil();

  const [[{ adet: kurumSayisi }], [{ adet: birimSayisi }], [{ adet: kullaniciSayisi }], [{ adet: rolSayisi }]] =
    await Promise.all([
      db.select({ adet: count() }).from(schema.kurumlar),
      db.select({ adet: count() }).from(schema.birimler),
      db.select({ adet: count() }).from(schema.kullanicilar),
      db.select({ adet: count() }).from(schema.roller),
    ]);

  const baglantiliKartlar = [
    { baslik: "Kurumlar", sayi: kurumSayisi, href: "/yonetim/kurumlar" },
    { baslik: "Roller", sayi: rolSayisi, href: "/yonetim/roller" },
  ];
  const bilgiKartlari = [
    { baslik: "Birimler", sayi: birimSayisi },
    { baslik: "Kullanıcılar", sayi: kullaniciSayisi },
  ];

  return (
    <YonetimShell activeHref="/yonetim" adSoyad={session.adSoyad}>
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="font-heading text-xl font-semibold text-foreground">Sistem Yönetimi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kurumları, birimleri, kullanıcıları ve rolleri buradan yönetin.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {baglantiliKartlar.map((k) => (
            <Link key={k.baslik} href={k.href}>
              <Card className="p-4 transition-colors hover:bg-muted">
                <p className="text-2xl font-semibold text-foreground">{k.sayi}</p>
                <p className="text-xs text-muted-foreground">{k.baslik}</p>
              </Card>
            </Link>
          ))}
          {bilgiKartlari.map((k) => (
            <Card key={k.baslik} className="p-4">
              <p className="text-2xl font-semibold text-foreground">{k.sayi}</p>
              <p className="text-xs text-muted-foreground">{k.baslik}</p>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Birimler ve kullanıcılar, ilgili kurumun sayfasından yönetilir.
        </p>
      </main>
    </YonetimShell>
  );
}
