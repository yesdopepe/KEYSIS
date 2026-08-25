"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { MagnifyingGlass, EnvelopeSimpleOpen, FileText, XCircle } from "@phosphor-icons/react/ssr";
import { PublicShell } from "@/components/PublicShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/Field";
import { Badge } from "@/components/ui/badge";
import { durumBilgisiGetir } from "@/lib/ui/durum";
import { ResmiBelgeOnizleme } from "@/components/belge/ResmiBelgeOnizleme";
import { IndirmeButonlari } from "@/components/belge/IndirmeButonlari";
import { basvuruDurumSorgula, type BasvuruDurumu } from "../actions";

export default function DurumIcerik() {
  const searchParams = useSearchParams();
  const [takipNo, setTakipNo] = useState(searchParams.get("takip") ?? "");
  const [sonuc, setSonuc] = useState<BasvuruDurumu | null>(null);
  const [arandi, setArandi] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);

  async function sorgula(e: FormEvent) {
    e.preventDefault();
    setYukleniyor(true);
    setArandi(false);
    try {
      const r = await basvuruDurumSorgula(takipNo);
      setSonuc(r);
    } finally {
      setYukleniyor(false);
      setArandi(true);
    }
  }

  const durum = sonuc ? durumBilgisiGetir(sonuc.durum) : null;

  return (
    <PublicShell activeHref="/basvuru/durum">
      <main className="flex items-center justify-center px-4 py-12">
        <div className={`w-full space-y-5 ${sonuc?.belge ? "max-w-3xl" : "max-w-lg"}`}>
          <Card className="p-6">
            <h1 className="font-heading text-xl font-semibold text-foreground">
              Başvuru Durumu Sorgula
            </h1>
            <form onSubmit={sorgula} className="mt-4 space-y-4">
              <Field label="Takip Numarası" htmlFor="takip-no" required>
                <input
                  id="takip-no"
                  required
                  className={`${inputClasses} font-mono uppercase tracking-wider`}
                  value={takipNo}
                  onChange={(e) => setTakipNo(e.target.value)}
                />
              </Field>
              <Button type="submit" disabled={yukleniyor} className="w-full">
                <MagnifyingGlass size={18} aria-hidden="true" />
                {yukleniyor ? "Sorgulanıyor..." : "Sorgula"}
              </Button>
            </form>
          </Card>

          {arandi && !sonuc && (
            <Card className="flex items-start gap-3 border-destructive-border bg-destructive-bg p-4">
              <XCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
              <p className="text-sm text-destructive">
                Bu takip numarasıyla bir başvuru bulunamadı. Numarayı kontrol edip tekrar deneyin.
              </p>
            </Card>
          )}

          {sonuc && durum && (
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-muted-foreground">{sonuc.takipNo}</span>
                <Badge ton={durum.ton}>{durum.etiket}</Badge>
              </div>
              <p className="text-sm text-foreground">
                <span className="font-semibold">Kurum:</span> {sonuc.kurumAdi ?? "—"}
              </p>

              {sonuc.bildirimGonderildiMi && (
                <div className="flex items-center gap-2 rounded-[var(--radius-control)] bg-success-bg px-3.5 py-2.5 text-sm font-medium text-success">
                  <EnvelopeSimpleOpen size={18} aria-hidden="true" />
                  E-posta/SMS ile bilgilendirme gönderildi (simüle edilmiştir).
                </div>
              )}

              {sonuc.belge && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <FileText size={16} aria-hidden="true" />
                      Yanıtınız
                    </p>
                    <IndirmeButonlari
                      temelHref={`/api/basvuru/${encodeURIComponent(sonuc.takipNo)}/disa-aktar`}
                    />
                  </div>
                  <div className="overflow-x-auto rounded-[var(--radius-control)] bg-muted p-3">
                    <ResmiBelgeOnizleme belge={sonuc.belge} />
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </main>
    </PublicShell>
  );
}
