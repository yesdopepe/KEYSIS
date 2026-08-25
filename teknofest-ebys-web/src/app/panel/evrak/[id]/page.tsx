import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  FileText,
  Sparkle,
  Scales,
  PencilSimpleLine,
  ListChecks,
  ArrowsLeftRight,
  ClockCounterClockwise,
  CheckCircle,
  XCircle,
  ArrowUUpLeft,
  WarningCircle,
  CircleDashed,
  FloppyDisk,
} from "@phosphor-icons/react/ssr";
import { db, schema } from "@/lib/db";
import { oturumZorunluKil } from "@/lib/auth/require-session";
import { evrakDetayGetir, tumKurumVeBirimler } from "@/lib/cases/queries";
import {
  hitlOnayla,
  havaleEt,
  onayAdimiKarar,
  taslakGuncelle,
  yaziOnerisiIste,
  yaziOneriKarar,
} from "../../actions";
import { StaffShell } from "@/components/StaffShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/Field";
import { durumBilgisiGetir } from "@/lib/ui/durum";
import { ResmiBelgeOnizleme } from "@/components/belge/ResmiBelgeOnizleme";
import { IndirmeButonlari } from "@/components/belge/IndirmeButonlari";
import { OneriIncelemesi } from "@/components/belge/OneriIncelemesi";
import { evraktanModel } from "@/lib/belgeler/modelle";
import { bekleyenOnerileriGetir } from "@/lib/belgeler/oneriler";
import { yanitTaslagiCoz } from "@/lib/belgeler/yanit-taslagi";
import type { MevzuatEslesmesi } from "@/lib/agents/reader";

const HIYERARSI_ETIKET: Record<number, string> = { 1: "Memur", 2: "Şube Müdürü", 3: "Daire Başkanı" };

export default async function EvrakDetaySayfasi({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await oturumZorunluKil();
  const [sessionBirim] = await db.select().from(schema.birimler).where(eq(schema.birimler.id, session.birimId));
  const [sessionKurum] = await db.select().from(schema.kurumlar).where(eq(schema.kurumlar.id, session.kurumId));

  const detay = await evrakDetayGetir(id);
  if (!detay) notFound();

  const { evrak, kurum, birim, onayAdimlari, havaleler, auditKayitlari } = detay;
  const yetkili = evrak.birimId === session.birimId;
  const mevzuatEslesmeleri: MevzuatEslesmesi[] = evrak.mevzuatEslesmeleri
    ? JSON.parse(evrak.mevzuatEslesmeleri)
    : [];

  const taslak = yanitTaslagiCoz(evrak.taslakYapisi);
  const yaziModeli = taslak
    ? evraktanModel(evrak, kurum?.ad ?? "Kurum", birim?.ad, {
        adSoyad: session.adSoyad,
        unvan: session.unvan,
      })
    : null;
  const yaziOnerileri = taslak ? await bekleyenOnerileriGetir("evrak", evrak.id) : [];

  const { kurumlar, birimler } = await tumKurumVeBirimler();
  const digerBirimler = birimler.filter((b) => b.id !== evrak.birimId);

  const siradakiAdim = onayAdimlari.find((a) => a.durum === "bekliyor");
  const oncekiTamam = siradakiAdim
    ? onayAdimlari.filter((a) => a.sira < siradakiAdim.sira).every((a) => a.durum === "onaylandi")
    : false;
  const benimSiram =
    yetkili && siradakiAdim && oncekiTamam && siradakiAdim.gerekliHiyerarsiSeviyesi === session.hiyerarsiSeviyesi;

  const taslakDuzenlenebilir =
    yetkili && (evrak.durum === "onay_zincirinde" || evrak.durum === "taslak_hazirlaniyor");

  const durum = durumBilgisiGetir(evrak.durum);

  return (
    <StaffShell
      activeHref="/panel"
      session={{
        adSoyad: session.adSoyad,
        unvan: session.unvan,
        hiyerarsiSeviyesi: session.hiyerarsiSeviyesi,
        bilgiTabaniYonetimi: session.bilgiTabaniYonetimi,
        mevzuatYonetimi: session.mevzuatYonetimi,
        birimAdi: sessionBirim?.ad,
        kurumAdi: sessionKurum?.ad,
      }}
    >
      <main className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{evrak.takipNo}</p>
            <h1 className="font-heading text-xl font-semibold text-foreground">{evrak.basvuruSahibiAdSoyad}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {evrak.evrakTuru} · {kurum?.ad} / {birim?.ad}
            </p>
          </div>
          <Badge ton={durum.ton}>{durum.etiket}</Badge>
        </div>

        {!yetkili && (
          <Card className="flex items-center gap-2.5 border-destructive-border bg-destructive-bg p-3.5">
            <WarningCircle size={20} weight="fill" className="shrink-0 text-destructive" aria-hidden="true" />
            <p className="text-sm text-destructive">
              Bu evrak sizin biriminize ait değil — yalnızca görüntüleyebilirsiniz.
            </p>
          </Card>
        )}

        <Card className="p-5 space-y-2">
          <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground">
            <FileText size={17} className="text-primary" aria-hidden="true" />
            Dilekçe Metni
          </h2>
          <p className="whitespace-pre-wrap text-sm text-foreground">{evrak.rawText}</p>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground">
            <Sparkle size={17} className="text-primary" aria-hidden="true" />
            AI Analizi
            <span className="ml-auto flex items-center gap-2 text-xs font-normal text-muted-foreground">
              Güven skoru: {evrak.confidence != null ? Math.round(evrak.confidence * 100) : "-"}% · Öncelik: {evrak.onceligi}
            </span>
          </h2>
          <p className="text-sm text-foreground">{evrak.analizOzeti}</p>
          {mevzuatEslesmeleri.length > 0 && (
            <div className="border-t border-border pt-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Scales size={14} aria-hidden="true" />
                İlgili Mevzuat
              </p>
              <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                {mevzuatEslesmeleri.map((m) => (
                  <li key={m.maddeKodu}>
                    {m.link ? (
                      <Link
                        href={m.link}
                        className="font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        {m.maddeKodu}
                      </Link>
                    ) : (
                      <span className="font-semibold text-foreground">{m.maddeKodu}</span>
                    )}{" "}
                    — {m.baslik}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {evrak.durum === "ic_incelemede" && yetkili && (
          <Card className="border-info-border bg-info-bg p-5 space-y-4">
            <h2 className="font-heading text-sm font-semibold text-primary">HITL — İnceleme Kararı</h2>
            <form action={hitlOnayla.bind(null, evrak.id)}>
              <Button type="submit">
                <CheckCircle size={18} aria-hidden="true" />
                Onayla ve Taslak Oluştur
              </Button>
            </form>

            {digerBirimler.length > 0 && (
              <form action={havaleEt.bind(null, evrak.id)} className="space-y-2.5 border-t border-info-border pt-4">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <ArrowsLeftRight size={16} aria-hidden="true" />
                  Başka bir kuruma/birime havale et
                </p>
                <select name="_hedef" className={`${inputClasses} bg-card`} required defaultValue="">
                  <option value="" disabled>
                    Kurum / birim seçin
                  </option>
                  {/* value carries "kurumId|birimId" — split server-side */}
                  {digerBirimler.map((b) => {
                    const k = kurumlar.find((k) => k.id === b.kurumId);
                    return (
                      <option key={b.id} value={`${b.kurumId}|${b.id}`}>
                        {k?.ad} — {b.ad}
                      </option>
                    );
                  })}
                </select>
                <input name="sebep" required placeholder="Havale sebebi" className={`${inputClasses} bg-card`} />
                <Button type="submit" variant="secondary">
                  Havale Et
                </Button>
              </form>
            )}
          </Card>
        )}

        {taslak && yaziModeli && (
          <Card className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground">
                <PencilSimpleLine size={17} className="text-primary" aria-hidden="true" />
                Cevap Yazısı
              </h2>
              <IndirmeButonlari temelHref={`/api/evrak/${evrak.id}/disa-aktar`} />
            </div>

            {yaziOnerileri.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Bekleyen değişiklik önerileri ({yaziOnerileri.length})
                </h3>
                {yaziOnerileri.map((oneri) => (
                  <OneriIncelemesi
                    key={oneri.id}
                    oneri={oneri}
                    guncelMetin={taslak.govdeMetni}
                    kabulEt={yaziOneriKarar.bind(null, evrak.id, "kabul")}
                    reddet={yaziOneriKarar.bind(null, evrak.id, "red")}
                    duzenlenebilir={taslakDuzenlenebilir}
                  />
                ))}
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                {taslakDuzenlenebilir ? (
                  <>
                    <form action={taslakGuncelle.bind(null, evrak.id)} className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label htmlFor="konu" className="block text-sm font-semibold text-foreground">
                            Konu
                          </label>
                          <input
                            id="konu"
                            name="konu"
                            defaultValue={taslak.konu}
                            className={`${inputClasses} mt-1.5`}
                          />
                        </div>
                        <div>
                          <label htmlFor="hitap" className="block text-sm font-semibold text-foreground">
                            Muhatap
                          </label>
                          <input
                            id="hitap"
                            name="hitap"
                            defaultValue={taslak.hitap}
                            className={`${inputClasses} mt-1.5`}
                          />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="govde_metni" className="block text-sm font-semibold text-foreground">
                          Yazı Metni
                        </label>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          İlgi satırı, gövde ve kapanış dahil, tek bir yazı olarak düzenleyin.
                        </p>
                        <textarea
                          id="govde_metni"
                          name="govde_metni"
                          defaultValue={taslak.govdeMetni}
                          rows={16}
                          className={`${inputClasses} mt-1.5 font-belge leading-relaxed`}
                        />
                      </div>
                      <Button type="submit" variant="outline" size="sm">
                        <FloppyDisk size={16} aria-hidden="true" />
                        Yazıyı Kaydet
                      </Button>
                    </form>

                    <div className="rounded-[var(--radius-control)] border border-border p-3.5">
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <Sparkle size={16} weight="fill" className="text-primary" aria-hidden="true" />
                        Yapay zekâdan revizyon iste
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Öneri yazıya doğrudan işlenmez; onayınızı bekler.
                      </p>
                      <form action={yaziOnerisiIste.bind(null, evrak.id)} className="mt-2.5 space-y-2.5">
                        <input
                          type="text"
                          name="talimat"
                          placeholder="Ne değişsin? (isteğe bağlı)"
                          className={inputClasses}
                        />
                        <Button type="submit" variant="secondary" size="sm">
                          <Sparkle size={16} aria-hidden="true" />
                          Öneri Hazırla
                        </Button>
                      </form>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Bu aşamada yazı düzenlenemez. Düzenleme, taslak hazırlama ve onay zinciri
                    aşamalarında ilgili birim tarafından yapılabilir.
                  </p>
                )}
              </div>

              <div className="overflow-x-auto rounded-[var(--radius-control)] bg-muted p-3">
                <ResmiBelgeOnizleme belge={yaziModeli} />
              </div>
            </div>
          </Card>
        )}

        {onayAdimlari.length > 0 && (
          <Card className="p-5 space-y-4">
            <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground">
              <ListChecks size={17} className="text-primary" aria-hidden="true" />
              Onay Zinciri
            </h2>
            <ol className="space-y-2.5">
              {onayAdimlari.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    {a.durum === "onaylandi" ? (
                      <CheckCircle size={18} weight="fill" className="text-success" aria-hidden="true" />
                    ) : a.durum === "bekliyor" ? (
                      <CircleDashed size={18} className="text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <XCircle size={18} weight="fill" className="text-destructive" aria-hidden="true" />
                    )}
                    {a.sira + 1}. {HIYERARSI_ETIKET[a.gerekliHiyerarsiSeviyesi] ?? `Seviye ${a.gerekliHiyerarsiSeviyesi}`}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{a.durum}</span>
                </li>
              ))}
            </ol>

            {benimSiram && siradakiAdim && (
              <div className="border-t border-border pt-4 space-y-2.5">
                <p className="text-sm font-semibold text-foreground">Bu adım sizin onayınızı bekliyor</p>
                <div className="flex flex-wrap gap-2">
                  <form action={onayAdimiKarar.bind(null, evrak.id, siradakiAdim.id, "onaylandi")}>
                    <input type="hidden" name="yorum" value="" />
                    <Button type="submit" variant="accent" size="sm">
                      <CheckCircle size={16} aria-hidden="true" />
                      Onayla
                    </Button>
                  </form>
                  <form action={onayAdimiKarar.bind(null, evrak.id, siradakiAdim.id, "duzeltme_istendi")}>
                    <input type="hidden" name="yorum" value="Düzeltme istendi" />
                    <Button type="submit" variant="outline" size="sm">
                      <ArrowUUpLeft size={16} aria-hidden="true" />
                      Düzeltme İste
                    </Button>
                  </form>
                  <form action={onayAdimiKarar.bind(null, evrak.id, siradakiAdim.id, "reddedildi")}>
                    <input type="hidden" name="yorum" value="Reddedildi" />
                    <Button type="submit" variant="destructive" size="sm">
                      <XCircle size={16} aria-hidden="true" />
                      Reddet
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </Card>
        )}

        {havaleler.length > 0 && (
          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground mb-2">
              <ArrowsLeftRight size={17} className="text-primary" aria-hidden="true" />
              Havale Geçmişi
            </h2>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {havaleler.map((h) => (
                <li key={h.id}>
                  {h.sebep} — {new Date(h.zaman!).toLocaleString("tr-TR")}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground mb-2">
            <ClockCounterClockwise size={17} className="text-primary" aria-hidden="true" />
            İşlem Geçmişi
          </h2>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {auditKayitlari.map((a) => (
              <li key={a.id}>
                {new Date(a.zaman).toLocaleString("tr-TR")} — {a.islem} ({a.kullanici})
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </StaffShell>
  );
}
