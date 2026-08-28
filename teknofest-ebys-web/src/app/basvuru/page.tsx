"use client";

import { useState, useEffect, useMemo, Suspense, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle,
  PaperPlaneTilt,
  Paperclip,
  Question,
  Warning,
  CopySimple,
  Sparkle,
  X,
  FilePdf,
  FileImage,
  FileText,
} from "@phosphor-icons/react/ssr";
import { PublicShell } from "@/components/PublicShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/Field";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  basvuruGonder,
  aiDilekceOlusturAction,
  type BasvuruFormSonucu,
} from "./actions";
import { eksikYerTutucular } from "@/lib/basvuru/eksiklik";

type Asama =
  | { tip: "form" }
  | { tip: "eksik_bilgi"; dilekceMetni: string; eksikAlanlar: { alan: string; soru: string }[] }
  | { tip: "tamamlandi"; takipNo: string };

function BasvuruIcerik() {
  const searchParams = useSearchParams();
  const [asama, setAsama] = useState<Asama>({ tip: "form" });
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const [dilekceMetni, setDilekceMetni] = useState("");
  const [adSoyad, setAdSoyad] = useState("");
  const [iletisim, setIletisim] = useState("");
  const [dosyalar, setDosyalar] = useState<File[]>([]);
  const [ekCevaplar, setEkCevaplar] = useState<Record<string, string>>({});
  const [kopyalandi, setKopyalandi] = useState(false);
  const [asistandanAktarildi, setAsistandanAktarildi] = useState(false);

  // AI Modal States
  const [aiModalAcik, setAiModalAcik] = useState(false);
  const [aiKonu, setAiKonu] = useState("");
  const [aiYukleniyor, setAiYukleniyor] = useState(false);
  const [aiHata, setAiHata] = useState<string | null>(null);

  useEffect(() => {
    // Check if there is a draft from the assistant in sessionStorage
    if (typeof window !== "undefined") {
      const kaydedilen =
        sessionStorage.getItem("otomatik_dilekce_metni") ||
        sessionStorage.getItem("keysis_dilekce_taslak") ||
        sessionStorage.getItem("ebys_dilekce_taslak");
      if (kaydedilen && kaydedilen.trim().length > 0) {
        setDilekceMetni(kaydedilen.trim());
        setAsistandanAktarildi(true);
        sessionStorage.removeItem("otomatik_dilekce_metni");
        sessionStorage.removeItem("keysis_dilekce_taslak");
        sessionStorage.removeItem("ebys_dilekce_taslak");
      }
    }
  }, [searchParams]);

  async function aiIleDilekceUret() {
    if (!aiKonu.trim()) {
      setAiHata("Lütfen talebinizi kısaca açıklayın.");
      return;
    }
    setAiHata(null);
    setAiYukleniyor(true);
    try {
      const uretilen = await aiDilekceOlusturAction(aiKonu);
      setDilekceMetni(uretilen);
      setAsistandanAktarildi(true);
      setAiModalAcik(false);
      setAiKonu("");
    } catch (err) {
      setAiHata(err instanceof Error ? err.message : "Dilekçe oluşturulamadı.");
    } finally {
      setAiYukleniyor(false);
    }
  }

  function dosyaEkle(secilenDosyalar: FileList | null) {
    if (!secilenDosyalar) return;
    const yeniListe = Array.from(secilenDosyalar);
    setDosyalar((onceki) => {
      const birlestirilmis = [...onceki];
      for (const d of yeniListe) {
        if (!birlestirilmis.some((b) => b.name === d.name && b.size === d.size)) {
          birlestirilmis.push(d);
        }
      }
      return birlestirilmis;
    });
  }

  function dosyaSil(index: number) {
    setDosyalar((onceki) => onceki.filter((_, i) => i !== index));
  }

  // Gaps the AI draft left behind ("[EK BİLGİ GEREKLİ: Tarih]"). The server
  // refuses a petition that still has them; checking here as well means the
  // citizen is told before they press send, not after.
  const doldurulmamisAlanlar = useMemo(() => eksikYerTutucular(dilekceMetni), [dilekceMetni]);

  function eksikleriDoldurmayaGec() {
    setHata(null);
    setEkCevaplar({});
    setAsama({ tip: "eksik_bilgi", dilekceMetni, eksikAlanlar: doldurulmamisAlanlar });
  }

  async function ilkGonderim(e: FormEvent) {
    e.preventDefault();
    if (doldurulmamisAlanlar.length > 0) {
      eksikleriDoldurmayaGec();
      return;
    }
    setHata(null);
    setYukleniyor(true);
    try {
      const sonuc = await basvuruGonder({
        dilekceMetni,
        basvuruSahibiAdSoyad: adSoyad,
        basvuruSahibiIletisim: iletisim,
        dosyalar,
      });
      isleSonuc(sonuc);
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  }

  async function ekBilgiGonderimi(e: FormEvent, mevcutDilekceMetni: string) {
    e.preventDefault();
    setHata(null);
    setYukleniyor(true);
    try {
      const sonuc = await basvuruGonder({
        dilekceMetni: mevcutDilekceMetni,
        ekCevaplar,
        basvuruSahibiAdSoyad: adSoyad,
        basvuruSahibiIletisim: iletisim,
        // Carried through the round trip: the attachments were chosen on the
        // form before the missing-field step and would otherwise be dropped.
        dosyalar,
      });
      isleSonuc(sonuc);
    } catch (err) {
      setHata(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  }

  function isleSonuc(sonuc: BasvuruFormSonucu) {
    if (sonuc.durum === "eksik_bilgi") {
      setAsama({ tip: "eksik_bilgi", dilekceMetni: sonuc.dilekceMetni, eksikAlanlar: sonuc.eksikAlanlar });
      setEkCevaplar({});
    } else {
      setAsama({ tip: "tamamlandi", takipNo: sonuc.takipNo });
    }
  }

  function takipNoKopyala(takipNo: string) {
    navigator.clipboard?.writeText(takipNo);
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 2000);
  }

  if (asama.tip === "tamamlandi") {
    return (
      <main className="flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-bg text-success">
            <CheckCircle size={30} weight="fill" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-heading text-xl font-semibold text-foreground">
            Başvurunuz alındı
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Takip numaranız</p>

          <div className="mt-3 flex items-center justify-center gap-2">
            <p className="rounded-[var(--radius-control)] bg-muted px-4 py-2 font-mono text-2xl font-bold tracking-wider text-foreground">
              {asama.takipNo}
            </p>
            <button
              type="button"
              onClick={() => takipNoKopyala(asama.takipNo)}
              aria-label="Takip numarasını kopyala"
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-border text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
            >
              {kopyalandi ? (
                <CheckCircle size={20} className="text-success" aria-hidden="true" />
              ) : (
                <CopySimple size={20} aria-hidden="true" />
              )}
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Bu numarayı saklayın — durumu sorgulamak için gerekecek.
          </p>
          <Link href={`/basvuru/durum?takip=${asama.takipNo}`} className="mt-6 block">
            <Button variant="accent" className="w-full">
              Durumu Şimdi Görüntüle
            </Button>
          </Link>
        </Card>
      </main>
    );
  }

  if (asama.tip === "eksik_bilgi") {
    return (
      <main className="flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg p-6">
          <div
            role="alert"
            className="flex items-start gap-3 rounded-[var(--radius-control)] border border-warning-border bg-warning-bg p-3.5"
          >
            <Question size={22} weight="fill" className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <h1 className="font-heading text-base font-semibold text-foreground">
                Birkaç bilgi daha gerekiyor
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Başvurunuzu tamamlayabilmemiz için aşağıdaki bilgilere ihtiyacımız var.
              </p>
            </div>
          </div>

          <form onSubmit={(e) => ekBilgiGonderimi(e, asama.dilekceMetni)} className="mt-5 space-y-4">
            {asama.eksikAlanlar.map((e, i) => (
              <Field key={e.alan} label={e.soru} htmlFor={`ek-${e.alan}`} required>
                <input
                  id={`ek-${e.alan}`}
                  required
                  autoFocus={i === 0}
                  className={inputClasses}
                  value={ekCevaplar[e.alan] ?? ""}
                  onChange={(ev) => setEkCevaplar((prev) => ({ ...prev, [e.alan]: ev.target.value }))}
                />
              </Field>
            ))}
            {hata && (
              <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <Warning size={16} aria-hidden="true" />
                {hata}
              </p>
            )}
            <Button type="submit" variant="accent" disabled={yukleniyor} className="w-full">
              {yukleniyor ? "Gönderiliyor..." : "Bilgileri Tamamla ve Gönder"}
            </Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center px-4 py-10 max-w-xl mx-auto w-full space-y-4">
      {/* Assistant Helper Banner */}
      <div className="w-full rounded-xl border border-primary/20 bg-primary/[0.04] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
            <Sparkle size={18} weight="fill" />
          </span>
          <div className="text-xs sm:text-sm">
            <p className="font-semibold text-foreground">Dilekçenizi nasıl yazacağınızı bilmiyor musunuz?</p>
            <p className="text-muted-foreground">Yetkili kurumu öğrenin ve resmi dilekçenizi yapay zekâ ile hazırlayın.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="brand"
            size="sm"
            onClick={() => setAiModalAcik(true)}
            className="h-8 text-xs gap-1.5 rounded-lg px-3 shadow-2xs font-semibold"
          >
            <Sparkle size={14} weight="fill" />
            <span>AI ile Oluştur</span>
          </Button>
          <Link
            href="/basvuru/asistan"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs"
          >
            Asistanı Aç →
          </Link>
        </div>
      </div>

      <Card className="w-full p-6 sm:p-7 shadow-xs">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-heading text-xl font-semibold text-foreground">Dilekçe Gönder</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Talebinizi anlatın; yapay zeka sistemi doğru kuruma ve birime yönlendirecektir.
            </p>
          </div>
          {asistandanAktarildi && (
            <Badge ton="basari" className="shrink-0 gap-1 text-2xs">
              <Sparkle size={12} weight="fill" />
              Yapay Zekâ ile Hazırlandı
            </Badge>
          )}
        </div>

        <form onSubmit={ilkGonderim} className="mt-5 space-y-4">
          <Field label="Ad Soyad" htmlFor="ad-soyad" required>
            <input
              id="ad-soyad"
              required
              className={inputClasses}
              value={adSoyad}
              onChange={(e) => setAdSoyad(e.target.value)}
            />
          </Field>

          <Field label="E-posta veya Telefon" htmlFor="iletisim" required>
            <input
              id="iletisim"
              required
              className={inputClasses}
              value={iletisim}
              onChange={(e) => setIletisim(e.target.value)}
            />
          </Field>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="dilekce-metni" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                Dilekçe Metni <span className="text-destructive">*</span>
              </label>
              <Button
                type="button"
                variant="brand"
                size="sm"
                onClick={() => setAiModalAcik(true)}
                className="h-7 text-xs gap-1.5 rounded-lg px-2.5 shadow-2xs font-semibold"
              >
                <Sparkle size={13} weight="fill" />
                <span>Yapay Zekâ ile Oluştur</span>
              </Button>
            </div>
            <textarea
              id="dilekce-metni"
              required
              rows={7}
              className={`${inputClasses} font-mono text-xs sm:text-sm leading-relaxed`}
              placeholder="3071 sayılı Kanuna uygun dilekçe metninizi buraya yazın veya 'Yapay Zekâ ile Oluştur' butonuna tıklayın..."
              value={dilekceMetni}
              onChange={(e) => setDilekceMetni(e.target.value)}
            />
            <p className="text-2xs text-muted-foreground">3071 sayılı Kanuna uygun resmi dilekçe metni</p>
          </div>

          <Field label="Ek Belgeler" htmlFor="dosya-yukle" hint="Opsiyonel — PDF, DOCX, görsel, tapu, tutanak vb.">
            <label
              htmlFor="dosya-yukle"
              className="mt-1.5 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed border-border px-3.5 py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Paperclip size={18} aria-hidden="true" />
              Dosya Seç veya Sürükle (Birden fazla seçebilirsiniz)
            </label>
            <input
              id="dosya-yukle"
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => dosyaEkle(e.target.files)}
            />

            {dosyalar.length > 0 && (
              <div className="mt-2.5 space-y-1.5">
                {dosyalar.map((d, index) => {
                  const DosyaIkon = d.type.startsWith("image/")
                    ? FileImage
                    : d.type === "application/pdf"
                    ? FilePdf
                    : FileText;

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-xs text-foreground border border-border"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <DosyaIkon size={16} className="text-primary shrink-0" />
                        <span className="truncate max-w-[280px]" title={d.name}>
                          {d.name}
                        </span>
                        <span className="text-muted-foreground text-2xs">
                          ({(d.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => dosyaSil(index)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Dosyayı kaldır"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Field>

          {hata && (
            <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <Warning size={16} aria-hidden="true" />
              {hata}
            </p>
          )}

          {doldurulmamisAlanlar.length > 0 && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-[var(--radius-control)] border border-warning-border bg-warning-bg p-3.5"
            >
              <Question size={20} weight="fill" className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Dilekçenizde doldurulmamış {doldurulmamisAlanlar.length} alan var
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Yapay zekâ taslağı bu bilgileri sizden bekliyor; tamamlanmadan başvuru
                  gönderilemez.
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {doldurulmamisAlanlar.map((alan) => (
                    <li
                      key={alan.alan}
                      className="rounded-full border border-warning-border bg-card px-2.5 py-0.5 text-xs font-medium text-foreground"
                    >
                      {alan.alan}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {doldurulmamisAlanlar.length > 0 ? (
            <Button type="button" variant="brand" onClick={eksikleriDoldurmayaGec} className="w-full">
              <Question size={18} aria-hidden="true" />
              Eksik Bilgileri Doldur
            </Button>
          ) : (
            <Button type="submit" disabled={yukleniyor} className="w-full">
              <PaperPlaneTilt size={18} aria-hidden="true" />
              {yukleniyor ? "Başvuru İşleniyor & Analiz Ediliyor..." : "Başvuruyu Gönder"}
            </Button>
          )}
        </form>
      </Card>

      {/* AI Dilekçe Oluşturma Dialog */}
      <Dialog open={aiModalAcik} onOpenChange={setAiModalAcik}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkle size={20} weight="fill" className="text-primary" />
              Yapay Zekâ ile Resmi Dilekçe Oluştur
            </DialogTitle>
            <DialogDescription>
              Talebinizi, şikayetinizi veya durumunuzu kısaca anlatın; yapay zeka 3071 sayılı Dilekçe Kanununa uygun resmi dilekçenizi saniyeler içinde hazırlasın.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Talebiniz / Şikayetiniz Nedir?</label>
              <textarea
                rows={3}
                value={aiKonu}
                onChange={(e) => setAiKonu(e.target.value)}
                placeholder="Örn: Mahallemizdeki çocuk parkının oyun aletleri kırık ve tehlike oluşturuyor. Yenilenmesini ve kauçuk zemin kaplanmasını talep ediyorum."
                className={`${inputClasses} text-xs leading-relaxed`}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Örnek Hızlı Konular:</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Yol ve kaldırım çukurlarının onarımı",
                  "Park ve çocuk oyun alanı bakımı",
                  "İmar durumu ve inşaat ruhsatı talebi",
                  "Aşırı gürültü ve zabıta denetimi",
                  "Sosyal yardım ve gıda desteği",
                  "Sokak lambası ve aydınlatma arızası",
                ].map((ornek) => (
                  <button
                    key={ornek}
                    type="button"
                    onClick={() => setAiKonu(ornek)}
                    className="rounded-md border border-border/80 bg-muted/50 px-2 py-1 text-[11px] text-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors cursor-pointer text-left"
                  >
                    + {ornek}
                  </button>
                ))}
              </div>
            </div>

            {aiHata && (
              <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <Warning size={14} aria-hidden="true" />
                {aiHata}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAiModalAcik(false)}
              disabled={aiYukleniyor}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={aiIleDilekceUret}
              disabled={aiYukleniyor || !aiKonu.trim()}
              className="gap-1.5"
            >
              <Sparkle size={15} weight="fill" />
              {aiYukleniyor ? "Dilekçe Hazırlanıyor..." : "Dilekçeyi Oluştur ve Forma Aktar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function BasvuruSayfasi() {
  return (
    <PublicShell activeHref="/basvuru">
      <Suspense fallback={<div className="flex justify-center p-12 text-sm text-muted-foreground">Yükleniyor...</div>}>
        <BasvuruIcerik />
      </Suspense>
    </PublicShell>
  );
}
