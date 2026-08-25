"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  CheckCircle,
  PaperPlaneTilt,
  Paperclip,
  Question,
  Warning,
  CopySimple,
} from "@phosphor-icons/react/ssr";
import { PublicShell } from "@/components/PublicShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/Field";
import { basvuruGonder, type BasvuruFormSonucu } from "./actions";

type Asama =
  | { tip: "form" }
  | { tip: "eksik_bilgi"; dilekceMetni: string; eksikAlanlar: { alan: string; soru: string }[] }
  | { tip: "tamamlandi"; takipNo: string };

export default function BasvuruSayfasi() {
  const [asama, setAsama] = useState<Asama>({ tip: "form" });
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const [dilekceMetni, setDilekceMetni] = useState("");
  const [adSoyad, setAdSoyad] = useState("");
  const [iletisim, setIletisim] = useState("");
  const [dosya, setDosya] = useState<File | null>(null);
  const [ekCevaplar, setEkCevaplar] = useState<Record<string, string>>({});
  const [kopyalandi, setKopyalandi] = useState(false);

  async function ilkGonderim(e: FormEvent) {
    e.preventDefault();
    setHata(null);
    setYukleniyor(true);
    try {
      const sonuc = await basvuruGonder({
        dilekceMetni,
        basvuruSahibiAdSoyad: adSoyad,
        basvuruSahibiIletisim: iletisim,
        dosya,
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
      <PublicShell activeHref="/basvuru">
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
      </PublicShell>
    );
  }

  if (asama.tip === "eksik_bilgi") {
    return (
      <PublicShell activeHref="/basvuru">
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
      </PublicShell>
    );
  }

  return (
    <PublicShell activeHref="/basvuru">
      <main className="flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-lg p-6">
          <h1 className="font-heading text-xl font-semibold text-foreground">Dilekçe Gönder</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Talebinizi anlatın; yapay zeka sistemi doğru kuruma ve birime yönlendirecektir.
          </p>

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

            <Field label="Dilekçe Metni" htmlFor="dilekce-metni" required>
              <textarea
                id="dilekce-metni"
                required
                rows={6}
                className={inputClasses}
                placeholder="Talebinizi buraya yazın..."
                value={dilekceMetni}
                onChange={(e) => setDilekceMetni(e.target.value)}
              />
            </Field>

            <Field label="Ek Belge" htmlFor="dosya" hint="Opsiyonel — PDF, DOCX, görsel">
              <label
                htmlFor="dosya"
                className="mt-1.5 flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-border px-3.5 py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Paperclip size={18} aria-hidden="true" />
                {dosya ? dosya.name : "Dosya seçin"}
              </label>
              <input
                id="dosya"
                type="file"
                className="sr-only"
                onChange={(e) => setDosya(e.target.files?.[0] ?? null)}
              />
            </Field>

            {hata && (
              <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                <Warning size={16} aria-hidden="true" />
                {hata}
              </p>
            )}

            <Button type="submit" disabled={yukleniyor} className="w-full">
              <PaperPlaneTilt size={18} aria-hidden="true" />
              {yukleniyor ? "Gönderiliyor..." : "Gönder"}
            </Button>
          </form>
        </Card>
      </main>
    </PublicShell>
  );
}
