import { notFound } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import {
  FileText,
  Sparkle,
  Scales,
  ListChecks,
  ArrowsLeftRight,
  ClockCounterClockwise,
  CheckCircle,
  XCircle,
  ArrowUUpLeft,
  WarningCircle,
  CircleDashed,
  Paperclip,
  Eye,
  DownloadSimple,
  FilePdf,
  FileImage,
  ShieldCheck,
  ShieldWarning,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/Field";
import { durumBilgisiGetir } from "@/lib/ui/durum";
import { CevapYazisiPaneli } from "@/components/belge/CevapYazisiPaneli";
import { DilekceOnizleme } from "@/components/belge/DilekceOnizleme";
import { BelgeSayfaCercevesi } from "@/components/belge/BelgeSayfaCercevesi";
import { evraktanModel } from "@/lib/belgeler/modelle";
import { tarihFormatla } from "@/lib/belgeler/resmi-belge";
import { bekleyenOnerileriGetir } from "@/lib/belgeler/oneriler";
import { yanitTaslagiCoz } from "@/lib/belgeler/yanit-taslagi";
import { guvenilirMevzuatEslesmeleri, type MevzuatEslesmesi } from "@/lib/agents/reader";
import type { EkAnalizSonucu } from "@/lib/agents/ek-analiz";

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

  const { evrak, kurum, birim, onayAdimlari, havaleler, auditKayitlari, ekler } = detay;
  const yetkili = evrak.birimId === session.birimId;
  // Filtered on read as well as on write, so cases filed before the
  // confidence threshold existed stop showing their weak matches too.
  const mevzuatEslesmeleri: MevzuatEslesmesi[] = guvenilirMevzuatEslesmeleri(
    evrak.mevzuatEslesmeleri ? JSON.parse(evrak.mevzuatEslesmeleri) : []
  );

  const ekAnalizi: EkAnalizSonucu | null = evrak.ekAnalizi
    ? (() => {
        try {
          return JSON.parse(evrak.ekAnalizi) as EkAnalizSonucu;
        } catch {
          return null;
        }
      })()
    : null;

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
  // The classifier caps its own score when the lexical ranking disagrees with
  // it (see mutabakatTavani), so anything under the top ceiling means the two
  // signals did not line up — which is exactly when a clerk should look.
  const dusukGuven = evrak.confidence != null && evrak.confidence < 0.8;

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
      <main className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
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

        <Card className="overflow-hidden">
          <h2 className="flex items-center gap-1.5 border-b border-border px-5 py-3.5 font-heading text-sm font-semibold text-foreground">
            <FileText size={17} className="text-primary" aria-hidden="true" />
            Dilekçe Metni
          </h2>
          <div className="bg-muted p-4 sm:p-6">
            <BelgeSayfaCercevesi>
              <DilekceOnizleme
                metin={evrak.rawText}
                basvuruSahibiAdSoyad={evrak.basvuruSahibiAdSoyad}
                basvuruSahibiIletisim={evrak.basvuruSahibiIletisim}
                takipNo={evrak.takipNo}
                kayitNo={evrak.kayitNo}
                tarih={tarihFormatla(evrak.olusturmaZamani)}
              />
            </BelgeSayfaCercevesi>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h2 className="flex flex-wrap items-center gap-1.5 font-heading text-sm font-semibold text-foreground">
            <Sparkle size={17} className="text-primary" aria-hidden="true" />
            AI Analizi
            <span className="ml-auto flex items-center gap-2 text-xs font-normal">
              <span className={dusukGuven ? "font-semibold text-warning" : "text-muted-foreground"}>
                Güven skoru: {evrak.confidence != null ? Math.round(evrak.confidence * 100) : "-"}%
                {dusukGuven && " — elle kontrol edin"}
              </span>
              <span className="text-muted-foreground">· Öncelik: {evrak.onceligi}</span>
            </span>
          </h2>
          {evrak.analizOzeti ? (
            <p className="text-sm text-foreground">{evrak.analizOzeti}</p>
          ) : (
            // Distinct from an empty summary on purpose: an analysis that never
            // ran should not be mistaken for one that found nothing to say.
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <WarningCircle size={16} className="shrink-0 text-warning" aria-hidden="true" />
              Yapay zekâ analizi bu evrak için yapılamadı; dilekçeyi elle değerlendirin.
            </p>
          )}
          {/* Collapsed by default: a mevzuat list is a reference the clerk
              opens when they want it, not a claim worth four lines of the
              summary card. Weak matches are already gone (see
              guvenilirMevzuatEslesmeleri) — what is left is worth a click. */}
          {mevzuatEslesmeleri.length > 0 && (
            <Accordion className="border-t border-border">
              <AccordionItem value="mevzuat" className="border-b-0">
                <AccordionTrigger className="text-xs font-semibold text-muted-foreground hover:no-underline">
                  <span className="flex items-center gap-1.5">
                    <Scales size={14} aria-hidden="true" />
                    İlgili Mevzuat ({mevzuatEslesmeleri.length})
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2.5">
                    {mevzuatEslesmeleri.map((m) => (
                      <li key={m.maddeKodu} className="text-xs">
                        <div className="flex flex-wrap items-baseline gap-x-1.5">
                          {m.link ? (
                            <Link
                              href={m.link}
                              className="font-semibold text-primary underline-offset-2 hover:underline"
                            >
                              {m.maddeKodu}
                            </Link>
                          ) : (
                            <span className="font-semibold text-foreground">{m.maddeKodu}</span>
                          )}
                          <span className="text-foreground">— {m.baslik}</span>
                          <span className="ml-auto shrink-0 text-muted-foreground">
                            benzerlik %{Math.round(m.benzerlikSkoru * 100)}
                          </span>
                        </div>
                        {m.icerikOzeti && (
                          <p className="mt-0.5 line-clamp-3 text-muted-foreground">
                            {m.icerikOzeti}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </Card>

        {/* Ek Belgeler (Attachments) Bölümü */}
        {ekler.length > 0 ? (
          <Card className="p-5 space-y-3">
            <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground">
              <Paperclip size={17} className="text-primary" aria-hidden="true" />
              Başvuru Ekleri ({ekler.length})
            </h2>
            <div className="divide-y divide-border rounded-[var(--radius-control)] border border-border">
              {ekler.map((ek) => {
                const url = `/api/evrak/${evrak.id}/ek/${ek.id}`;
                const DosyaIkon =
                  ek.tur === "gorsel"
                    ? FileImage
                    : ek.tur === "pdf" || ek.mimeTur === "application/pdf"
                    ? FilePdf
                    : FileText;

                return (
                  <div
                    key={ek.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-primary/10 text-primary">
                        <DosyaIkon size={20} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-foreground truncate" title={ek.ad}>
                          {ek.ad}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(ek.boyut / 1024).toFixed(1)} KB · {ek.mimeTur}
                          {ek.analizOzeti && (
                            <span className="block sm:inline sm:ml-2 text-foreground/80 font-normal">
                              — {ek.analizOzeti}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <Eye size={14} aria-hidden="true" />
                        Görüntüle
                      </a>
                      <a
                        href={url}
                        download={ek.ad}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] bg-primary/10 text-primary px-2.5 py-1.5 text-xs font-medium hover:bg-primary/20 transition-colors"
                      >
                        <DownloadSimple size={14} aria-hidden="true" />
                        İndir
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ) : evrak.dosyaAdi ? (
          <Card className="p-5 space-y-2">
            <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground">
              <Paperclip size={17} className="text-primary" aria-hidden="true" />
              Başvuru Eki
            </h2>
            <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-border p-3">
              <span className="text-sm font-medium text-foreground">{evrak.dosyaAdi}</span>
              <Badge ton="notr">Kayıtlı Belge</Badge>
            </div>
          </Card>
        ) : null}

        {/* Yapay Zekâ Ek Belge Analizi & Çapraz Doğrulama */}
        {ekAnalizi && (
          <Card className="p-5 space-y-4 border-primary/20 bg-primary/[0.02]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground">
                <Sparkle size={17} weight="fill" className="text-primary" aria-hidden="true" />
                AI Ek Belge & Delil Analizi
              </h2>
              <Badge
                ton={
                  ekAnalizi.tutarlilikDurumu === "uyumlu"
                    ? "basari"
                    : ekAnalizi.tutarlilikDurumu === "incelenmeli"
                    ? "uyari"
                    : ekAnalizi.tutarlilikDurumu === "eksik"
                    ? "bilgi"
                    : "tehlike"
                }
              >
                {ekAnalizi.tutarlilikDurumu === "uyumlu"
                  ? "✓ Beyan ve Ekler Uyumlu"
                  : ekAnalizi.tutarlilikDurumu === "incelenmeli"
                  ? "⚠ Ek İnceleme Gerekir"
                  : ekAnalizi.tutarlilikDurumu === "eksik"
                  ? "ℹ Eksik Belge / Belirtilen Ek Yok"
                  : "✕ Çelişki / Uyuşmazlık Tespiti"}
              </Badge>
            </div>

            <p className="text-sm text-foreground leading-relaxed">{ekAnalizi.genelOzet}</p>

            {ekAnalizi.tespitEdilenBelgeler.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground mr-1">
                  Tespit Edilen Belge Türleri:
                </span>
                {ekAnalizi.tespitEdilenBelgeler.map((tur, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
                  >
                    {tur}
                  </span>
                ))}
              </div>
            )}

            {ekAnalizi.caprazDogrulamaNotlari.length > 0 && (
              <div className="rounded-[var(--radius-control)] bg-success-bg border border-success-border p-3.5 space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
                  <ShieldCheck size={16} weight="fill" aria-hidden="true" />
                  Çapraz Doğrulama Bulguları
                </p>
                <ul className="space-y-1 text-xs text-foreground/90 pl-5 list-disc">
                  {ekAnalizi.caprazDogrulamaNotlari.map((not, idx) => (
                    <li key={idx}>{not}</li>
                  ))}
                </ul>
              </div>
            )}

            {ekAnalizi.eksikVeyaSupheliHususlar.length > 0 && (
              <div className="rounded-[var(--radius-control)] bg-warning-bg border border-warning-border p-3.5 space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                  <ShieldWarning size={16} weight="fill" aria-hidden="true" />
                  Dikkat Edilmesi Gereken Hususlar & Eksikler
                </p>
                <ul className="space-y-1 text-xs text-foreground/90 pl-5 list-disc">
                  {ekAnalizi.eksikVeyaSupheliHususlar.map((husus, idx) => (
                    <li key={idx}>{husus}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

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
          <CevapYazisiPaneli
            taslak={taslak}
            model={yaziModeli}
            oneriler={yaziOnerileri}
            duzenlenebilir={taslakDuzenlenebilir}
            disaAktarHref={`/api/evrak/${evrak.id}/disa-aktar`}
            kaydet={taslakGuncelle.bind(null, evrak.id)}
            revizyonIste={yaziOnerisiIste.bind(null, evrak.id)}
            oneriKabul={yaziOneriKarar.bind(null, evrak.id, "kabul")}
            oneriRed={yaziOneriKarar.bind(null, evrak.id, "red")}
          />
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
