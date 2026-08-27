import Link from "next/link";
import { and, eq, desc } from "drizzle-orm";
import { CaretRight, ChatCircleText } from "@phosphor-icons/react/ssr";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { belgeTuruGetir } from "@/lib/belgeler/turler";
import { durumBilgisiGetir } from "@/lib/ui/durum";
import { StaffShell } from "@/components/StaffShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-variants";

export default async function BelgelerimSayfasi() {
  const session = await oturumZorunluKil();
  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, session.birimId));
  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, session.kurumId));

  // The list is birim-wide on purpose ("Biriminizde oluşturulan belgeler") —
  // that is what lets a müdür open and approve a memur's document. The chat
  // that produced it, however, is private to its author: sohbetGetir resolves
  // by (id, kullaniciId, kurumId), so deep-linking a colleague into it 404s.
  // Join the conversation only when this user actually owns it, and fall back
  // to the standalone canvas otherwise.
  const belgeler = await db
    .select({
      id: schema.belgeler.id,
      baslik: schema.belgeler.baslik,
      belgeTuru: schema.belgeler.belgeTuru,
      durum: schema.belgeler.durum,
      olusturmaZamani: schema.belgeler.olusturmaZamani,
      sohbetId: schema.sohbetler.id,
    })
    .from(schema.belgeler)
    .leftJoin(
      schema.sohbetler,
      and(
        eq(schema.sohbetler.id, schema.belgeler.sohbetId),
        eq(schema.sohbetler.kullaniciId, session.userId),
        eq(schema.sohbetler.kurumId, session.kurumId)
      )
    )
    .where(eq(schema.belgeler.birimId, session.birimId))
    .orderBy(desc(schema.belgeler.olusturmaZamani));

  return (
    <StaffShell
      activeHref="/panel/belge"
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
      <main className="mx-auto w-full max-w-4xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Belgelerim</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Biriminizde oluşturulan belgeler.</p>
          </div>
          <Link href="/panel/asistan" className={buttonClasses("primary", "md")}>
            <ChatCircleText size={18} aria-hidden="true" />
            Asistanla Yeni Belge
          </Link>
        </div>

        <div className="mt-6">
          {belgeler.length === 0 ? (
            <Card className="p-4 text-sm text-muted-foreground">
              Henüz belge oluşturulmadı — kurum asistanına bir belge taslağı hazırlamasını isteyin.
            </Card>
          ) : (
            <Card className="divide-y divide-border overflow-hidden">
              {belgeler.map((b) => {
                const tur = belgeTuruGetir(b.belgeTuru);
                const durum = durumBilgisiGetir(b.durum);
                // Documents made through chat stay reachable from that
                // conversation (tool badges, the request that produced it);
                // ones whose chat this user does not own — a colleague's
                // document, or one whose chat was deleted — open the
                // standalone canvas page instead.
                const href = b.sohbetId ? `/panel/asistan/${b.sohbetId}?belge=${b.id}` : `/panel/belge/${b.id}`;
                return (
                  <Link
                    key={b.id}
                    href={href}
                    className="flex min-h-11 items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{b.baslik}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {tur?.ad ?? b.belgeTuru} · {new Date(b.olusturmaZamani).toLocaleDateString("tr-TR")}
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
        </div>
      </main>
    </StaffShell>
  );
}
