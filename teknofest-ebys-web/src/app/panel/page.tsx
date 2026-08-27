import Link from "next/link";
import { eq } from "drizzle-orm";
import { ClipboardText, CheckCircle, PaperPlaneTilt, CaretRight } from "@phosphor-icons/react/ssr";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { birimEvraklariGetir, onayimBekleyenEvraklarGetir, onayimBekleyenBelgelerGetir } from "@/lib/cases/queries";
import { belgeTuruGetir } from "@/lib/belgeler/turler";
import { StaffShell } from "@/components/StaffShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { durumBilgisiGetir } from "@/lib/ui/durum";

export default async function PanelSayfasi() {
  const session = await oturumZorunluKil();
  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, session.birimId));
  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, session.kurumId));

  const incelemeBekleyenler = await birimEvraklariGetir(session.birimId, ["ic_incelemede"]);
  const onayBekleyenler = await onayimBekleyenEvraklarGetir(session.birimId, session.hiyerarsiSeviyesi);
  const benimSiramOlanlar = onayBekleyenler.filter((o) => o.benimSiram);
  const gonderilenler = await birimEvraklariGetir(session.birimId, ["gonderildi"]);

  const onayBekleyenBelgeler = await onayimBekleyenBelgelerGetir(session.birimId, session.hiyerarsiSeviyesi);
  const benimSiramOlanBelgeler = onayBekleyenBelgeler.filter((o) => o.benimSiram);

  return (
    <StaffShell
      activeHref="/panel"
      session={{
        adSoyad: session.adSoyad,
        unvan: session.unvan,
        birimAdi: birim?.ad,
        kurumAdi: kurum?.ad,
        hiyerarsiSeviyesi: session.hiyerarsiSeviyesi,
        bilgiTabaniYonetimi: session.bilgiTabaniYonetimi,
        mevzuatYonetimi: session.mevzuatYonetimi,
      }}
    >
      <main className="mx-auto w-full max-w-5xl px-4 py-8 space-y-8">
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Bekleyen İşler</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {birim?.ad} · {kurum?.ad}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatKart
            baslik="İncelenecek"
            sayi={incelemeBekleyenler.length}
            ikon={<ClipboardText size={20} aria-hidden="true" />}
            ton="uyari"
          />
          <StatKart
            baslik="Onayımı Bekleyen"
            sayi={benimSiramOlanlar.length + benimSiramOlanBelgeler.length}
            ikon={<CheckCircle size={20} aria-hidden="true" />}
            ton="bilgi"
          />
          <StatKart
            baslik="Gönderilen"
            sayi={gonderilenler.length}
            ikon={<PaperPlaneTilt size={20} aria-hidden="true" />}
            ton="basari"
          />
        </div>

        <EvrakBolumu
          baslik="İncelemem Gereken Evraklar"
          evraklar={incelemeBekleyenler}
          bosMesaj="İnceleme bekleyen evrak yok."
        />
        <EvrakBolumu
          baslik="Onayımı Bekleyen Evraklar"
          evraklar={benimSiramOlanlar.map((o) => o.evrak)}
          bosMesaj="Onay bekleyen evrak yok."
        />
        <BelgeBolumu
          baslik="Onayımı Bekleyen Belgeler"
          belgeler={benimSiramOlanBelgeler.map((o) => o.belge)}
          bosMesaj="Onay bekleyen belge yok."
        />
        <EvrakBolumu baslik="Gönderilenler" evraklar={gonderilenler} bosMesaj="Henüz gönderilen evrak yok." />
      </main>
    </StaffShell>
  );
}

function StatKart({
  baslik,
  sayi,
  ikon,
  ton,
}: {
  baslik: string;
  sayi: number;
  ikon: React.ReactNode;
  ton: "uyari" | "bilgi" | "basari";
}) {
  const TON_SINIF = {
    uyari: "bg-warning-bg text-warning",
    bilgi: "bg-info-bg text-info",
    basari: "bg-success-bg text-success",
  }[ton];

  return (
    <Card className="flex items-center gap-3.5 p-5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] ${TON_SINIF}`}>
        {ikon}
      </span>
      <div>
        <p className="text-2xl font-bold text-foreground">{sayi}</p>
        <p className="text-xs font-medium text-muted-foreground">{baslik}</p>
      </div>
    </Card>
  );
}

function BelgeBolumu({
  baslik,
  belgeler,
  bosMesaj,
}: {
  baslik: string;
  belgeler: Array<typeof schema.belgeler.$inferSelect>;
  bosMesaj: string;
}) {
  return (
    <section>
      <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">
        {baslik}
        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {belgeler.length}
        </span>
      </h2>
      {belgeler.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">{bosMesaj}</Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {belgeler.map((b) => {
            const tur = belgeTuruGetir(b.belgeTuru);
            const durum = durumBilgisiGetir(b.durum);
            return (
              <Link
                key={b.id}
                href={`/panel/belge/${b.id}`}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{b.baslik}</p>
                  <p className="truncate text-xs text-muted-foreground">{tur?.ad ?? b.belgeTuru}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge ton={durum.ton}>{durum.etiket}</Badge>
                  <CaretRight size={16} className="text-muted-foreground" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </Card>
      )}
    </section>
  );
}

function EvrakBolumu({
  baslik,
  evraklar,
  bosMesaj,
}: {
  baslik: string;
  evraklar: Array<typeof schema.evraklar.$inferSelect>;
  bosMesaj: string;
}) {
  return (
    <section>
      <h2 className="mb-3 font-heading text-sm font-semibold text-foreground">
        {baslik}
        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {evraklar.length}
        </span>
      </h2>
      {evraklar.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">{bosMesaj}</Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {evraklar.map((e) => {
            const durum = durumBilgisiGetir(e.durum);
            return (
              <Link
                key={e.id}
                href={`/panel/evrak/${e.id}`}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{e.basvuruSahibiAdSoyad}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.evrakTuru} · {e.takipNo}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge ton={durum.ton}>{durum.etiket}</Badge>
                  <CaretRight size={16} className="text-muted-foreground" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </Card>
      )}
    </section>
  );
}
