import Link from "next/link";
import { FileText, MagnifyingGlass, Buildings, IdentificationBadge, Clock, Sparkle, Scales } from "@phosphor-icons/react/ssr";
import { PublicShell } from "@/components/PublicShell";
import { Card } from "@/components/ui/card";

export default function AnaSayfa() {
  return (
    <PublicShell activeHref="/">
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Dilekçenizi gönderin, süreci baştan sona takip edin
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
            Yapay zeka talebinizi doğru kuruma ve birime yönlendirir, ilgili memur inceleyip
            size resmi bir yanıt hazırlar — hepsi tek bir başvuru üzerinden.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Link href="/basvuru/asistan">
            <Card className="group h-full p-5 transition-all hover:border-primary border-primary/30 bg-gradient-to-b from-primary/[0.04] to-card">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-primary text-on-primary shadow-2xs">
                <Sparkle size={20} weight="fill" aria-hidden="true" />
              </span>
              <h2 className="mt-3 font-heading text-base font-semibold text-foreground flex items-center gap-1.5">
                Dilekçe & Kurum Asistanı
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Yapay zekâ ile yetkili kurumu öğrenin, 3071 uyumlu resmi dilekçenizi hazırlayın.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Asistanı başlat
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </Card>
          </Link>

          <Link href="/basvuru">
            <Card className="group h-full p-5 transition-colors hover:border-primary">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-primary/15 text-primary">
                <FileText size={20} aria-hidden="true" />
              </span>
              <h2 className="mt-3 font-heading text-base font-semibold text-foreground">
                Dilekçe Gönder
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Vatandaş başvurusu — hesap oluşturmanıza gerek yok, hemen başlayın.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Başvuruya başla
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </Card>
          </Link>

          <Link href="/basvuru/durum">
            <Card className="group h-full p-5 transition-colors hover:border-primary">
              <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-brand text-brand-foreground">
                <MagnifyingGlass size={20} aria-hidden="true" />
              </span>
              <h2 className="mt-3 font-heading text-base font-semibold text-foreground">
                Başvuru Durumu Sorgula
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Takip numaranızla başvurunuzun durumunu ve yanıtını görüntüleyin.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                Durumu görüntüle
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </Card>
          </Link>
        </div>

        <div className="mt-8 grid gap-5 border-t border-border pt-6 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <Buildings size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Doğru kuruma yönlendirme</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Yapay zeka, talebinizi analiz ederek ilgili kurum ve birime otomatik iletir.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <IdentificationBadge size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">İnsan onaylı süreç</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Her başvuru, ilgili memur ve amirin onayından geçtikten sonra yanıtlanır.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h3 className="text-sm font-semibold text-foreground">Şeffaf takip</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Başvurunuzun her aşamasını takip numaranızla anında görüntüleyin.
              </p>
            </div>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}
