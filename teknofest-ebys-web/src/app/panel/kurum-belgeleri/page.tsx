import { eq } from "drizzle-orm";
import { Books, UploadSimple, Trash, Info } from "@phosphor-icons/react/ssr";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { kurumBelgeleriniListele } from "@/lib/bilgi-tabani";
import { StaffShell } from "@/components/StaffShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/Field";
import { BILGI_TABANI_MIN_SEVIYE } from "@/lib/auth/seviyeler";
import { kurumBelgesiYukle, kurumBelgesiKaldir } from "./actions";

export default async function KurumBelgeleriSayfasi() {
  const session = await oturumZorunluKil();
  const [birim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, session.birimId));
  const [kurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, session.kurumId));

  const shellSession = {
    adSoyad: session.adSoyad,
    unvan: session.unvan,
    hiyerarsiSeviyesi: session.hiyerarsiSeviyesi,
    bilgiTabaniYonetimi: session.bilgiTabaniYonetimi,
    mevzuatYonetimi: session.mevzuatYonetimi,
    birimAdi: birim?.ad,
    kurumAdi: kurum?.ad,
  };

  // Authorization is enforced in the action too — this only avoids showing a
  // form the user could not submit. Mirrors oturumIzinliKil's OR: the
  // legacy level-3 rule or an explicit role grant, either is enough.
  if (session.hiyerarsiSeviyesi < BILGI_TABANI_MIN_SEVIYE && !session.bilgiTabaniYonetimi) {
    return (
      <StaffShell activeHref="/panel/kurum-belgeleri" session={shellSession}>
        <main className="mx-auto w-full max-w-2xl px-4 py-8">
          <Card className="border-destructive-border bg-destructive-bg p-5">
            <p className="text-sm text-destructive">
              Kurum bilgi tabanını yalnızca daire başkanı seviyesindeki kullanıcılar yönetebilir.
            </p>
          </Card>
        </main>
      </StaffShell>
    );
  }

  const belgeler = await kurumBelgeleriniListele(session.kurumId);

  return (
    <StaffShell activeHref="/panel/kurum-belgeleri" session={shellSession}>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-semibold text-foreground">
            <Books size={22} className="text-primary" aria-hidden="true" />
            Kurum Bilgi Tabanı
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Buraya yüklenen yönetmelik, genelge ve iç prosedürler Kurum Asistanı&apos;nın
            yanıtlarının kaynağıdır. Asistan yalnızca bu belgelerden ve mevzuat
            külliyatından cevap verir, her yanıtta kaynağını belirtir.
          </p>
        </div>

        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <UploadSimple size={17} className="text-primary" aria-hidden="true" />
            Yeni belge ekle
          </h2>
          <form action={kurumBelgesiYukle} className="mt-3 space-y-4">
            <Field label="Belge adı" htmlFor="ad" required>
              <input
                id="ad"
                name="ad"
                required
                placeholder="örn. İmar Yönetmeliği Uygulama Genelgesi 2026/3"
                className={inputClasses}
              />
            </Field>

            <Field
              label="Dosya"
              htmlFor="dosya"
              hint="PDF, DOCX veya taranmış görüntü. Metin çıkarımı Docling servisi ile yapılır."
            >
              <input
                id="dosya"
                name="dosya"
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md,.png,.jpg,.jpeg"
                className={inputClasses}
              />
            </Field>

            <Field label="veya metni yapıştırın" htmlFor="metin">
              <textarea id="metin" name="metin" rows={6} className={inputClasses} />
            </Field>

            <Button type="submit">
              <UploadSimple size={18} aria-hidden="true" />
              Bilgi Tabanına Ekle
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Yüklü belgeler ({belgeler.length})
          </h2>
          {belgeler.length === 0 ? (
            <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-control)] bg-info-bg p-3">
              <Info size={18} weight="fill" className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
              <p className="text-sm text-info">
                Henüz belge yok. Asistan, bilgi tabanı boşken kurum belgelerine dayalı
                soruları yanıtlayamaz.
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {belgeler.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{b.ad}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.dosyaAdi ? `${b.dosyaAdi} · ` : ""}
                      {b.yukleyen ?? "—"} · {b.olusturmaZamani.toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                  <form action={kurumBelgesiKaldir.bind(null, b.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      <Trash size={16} aria-hidden="true" />
                      Kaldır
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </StaffShell>
  );
}
