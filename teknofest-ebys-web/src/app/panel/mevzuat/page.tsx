import Link from "next/link";
import { eq } from "drizzle-orm";
import { Scales, UploadSimple, Trash, Info, NotePencil } from "@phosphor-icons/react/ssr";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { mevzuatMaddeleriniListele } from "@/lib/mevzuat";
import { StaffShell } from "@/components/StaffShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/Field";
import { MEVZUAT_MIN_SEVIYE } from "@/lib/auth/seviyeler";
import { mevzuatYukle, mevzuatMaddesiEkleAction, mevzuatMaddesiKaldir } from "./actions";

/** Shared between both forms — a cross-institution entry must be opted into. */
function KapsamAlani({ kurumAdi }: { kurumAdi?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm text-muted-foreground">
      <input type="checkbox" name="tum_kurumlar" className="mt-0.5" />
      <span>
        Tüm kurumlar için geçerli (ulusal mevzuat). İşaretlenmezse yalnızca{" "}
        <strong className="text-foreground">{kurumAdi ?? "bu kurum"}</strong> içinde görünür.
      </span>
    </label>
  );
}

export default async function MevzuatSayfasi() {
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

  // Authorization is enforced in the actions too — this only avoids showing a
  // form the user could not submit. Mirrors oturumIzinliKil's OR: the
  // legacy level-3 rule or an explicit role grant, either is enough.
  if (session.hiyerarsiSeviyesi < MEVZUAT_MIN_SEVIYE && !session.mevzuatYonetimi) {
    return (
      <StaffShell activeHref="/panel/mevzuat" session={shellSession}>
        <main className="mx-auto w-full max-w-2xl px-4 py-8">
          <Card className="border-destructive-border bg-destructive-bg p-5">
            <p className="text-sm text-destructive">
              Mevzuat külliyatını yalnızca daire başkanı seviyesindeki kullanıcılar yönetebilir.
            </p>
          </Card>
        </main>
      </StaffShell>
    );
  }

  const maddeler = await mevzuatMaddeleriniListele(session.kurumId);

  return (
    <StaffShell activeHref="/panel/mevzuat" session={shellSession}>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-semibold text-foreground">
            <Scales size={22} className="text-primary" aria-hidden="true" />
            Mevzuat Külliyatı
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Buraya yüklenen kanun ve yönetmelikler madde madde ayrılır; asistan, evrak
            analizi ve belge taslakları hukuki dayanağını bu maddelerden alır ve her
            atıfta maddeye bağlantı verir.
          </p>
        </div>

        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <UploadSimple size={17} className="text-primary" aria-hidden="true" />
            Mevzuat yükle
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Metin &quot;MADDE 1 –&quot; biçimindeki başlıklardan otomatik olarak maddelere
            ayrılır. Bu biçimde başlık bulunamazsa tüm metin tek madde olarak kaydedilir.
          </p>
          <form action={mevzuatYukle} className="mt-3 space-y-4">
            <Field label="Kanun / yönetmelik numarası" htmlFor="kanun_kodu" required>
              <input
                id="kanun_kodu"
                name="kanun_kodu"
                required
                placeholder="örn. 5393"
                className={inputClasses}
              />
            </Field>

            <Field label="Kanun / yönetmelik adı" htmlFor="kanun_adi" required>
              <input
                id="kanun_adi"
                name="kanun_adi"
                required
                placeholder="örn. Belediye Kanunu"
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
              <textarea id="metin" name="metin" rows={8} className={inputClasses} />
            </Field>

            <KapsamAlani kurumAdi={kurum?.ad} />

            <Button type="submit">
              <UploadSimple size={18} aria-hidden="true" />
              Maddelere Ayır ve Ekle
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <NotePencil size={17} className="text-primary" aria-hidden="true" />
            Tek madde ekle
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Otomatik ayırma hatalıysa ilgili maddeyi kaldırıp buradan elle girebilirsiniz.
          </p>
          <form action={mevzuatMaddesiEkleAction} className="mt-3 space-y-4">
            <Field label="Madde kodu" htmlFor="kodu" required>
              <input
                id="kodu"
                name="kodu"
                required
                placeholder="örn. 5393/15"
                className={inputClasses}
              />
            </Field>

            <Field label="Madde başlığı" htmlFor="baslik" required>
              <input
                id="baslik"
                name="baslik"
                required
                placeholder="örn. Belediyenin Yetkileri"
                className={inputClasses}
              />
            </Field>

            <Field label="Madde metni" htmlFor="icerik" required>
              <textarea id="icerik" name="icerik" rows={6} required className={inputClasses} />
            </Field>

            <KapsamAlani kurumAdi={kurum?.ad} />

            <Button type="submit" variant="outline">
              <NotePencil size={18} aria-hidden="true" />
              Maddeyi Ekle
            </Button>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Kayıtlı maddeler ({maddeler.length})
          </h2>
          {maddeler.length === 0 ? (
            <div className="mt-3 flex items-start gap-2 rounded-[var(--radius-control)] bg-info-bg p-3">
              <Info size={18} weight="fill" className="mt-0.5 shrink-0 text-info" aria-hidden="true" />
              <p className="text-sm text-info">
                Henüz madde yok. Mevzuat külliyatı boşken asistan ve belge taslakları
                hukuki dayanak gösteremez.
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {maddeler.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/panel/mevzuat/${m.id}`}
                      className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {m.kodu} — {m.baslik}
                    </Link>
                    <p className="mt-0.5">
                      <Badge ton={m.kurumId === null ? "bilgi" : "notr"}>
                        {m.kurumId === null ? "Tüm kurumlar" : (kurum?.ad ?? "Bu kurum")}
                      </Badge>
                    </p>
                  </div>
                  <form action={mevzuatMaddesiKaldir.bind(null, m.id)}>
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
