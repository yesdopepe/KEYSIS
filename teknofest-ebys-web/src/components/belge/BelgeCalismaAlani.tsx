"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  FileText,
  Sparkle,
  GitFork,
  Scales,
  CheckCircle,
  XCircle,
  ArrowUUpLeft,
  CircleDashed,
  ArrowsLeftRight,
  PaperPlaneTilt,
  LinkSimple,
  ArrowsOut,
  ArrowsIn,
  Printer,
} from "@phosphor-icons/react/ssr";
import type { ResmiBelge } from "@/lib/belgeler/resmi-belge";
import type { BelgeKaynagi } from "@/lib/agents/belge-yazar";
import type { OneriKaydi } from "@/lib/belgeler/oneriler";
import type { DurumBilgisi } from "@/lib/ui/durum";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputClasses } from "@/components/ui/Field";
import { GovdeEditoru } from "@/components/belge/GovdeEditoru";
import { IndirmeButonlari } from "@/components/belge/IndirmeButonlari";
import { OneriIncelemesi } from "@/components/belge/OneriIncelemesi";
import {
  belgeMetniKaydet,
  belgeGuncelle,
  belgeOneriKarar,
  belgeyiOnayaGonder,
  belgeOnayAdimiKarar,
  belgeHavaleEt,
  belgeyiEvrakaYanitYap,
} from "@/app/panel/belge/actions";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { basvuruGonder } from "@/app/basvuru/actions";

const HIYERARSI_ETIKET: Record<number, string> = { 1: "Memur", 2: "Şube Müdürü", 3: "Daire Başkanı" };

export interface BelgeCalismaAlaniProps {
  belge: {
    id: string;
    baslik: string;
    belgeTuru: string;
    govdeMetni: string;
    durum: string;
    tarih?: string | null;
  };
  model: ResmiBelge;
  turAdi: string;
  durum: DurumBilgisi;
  kaynaklar: BelgeKaynagi[];
  oneriler: OneriKaydi[];
  onayAdimlari: Array<{
    id: number;
    sira: number;
    gerekliHiyerarsiSeviyesi: number;
    durum: string;
  }>;
  yetkili: boolean;
  benimSiram: boolean;
  siradakiAdimId?: number;
  digerBirimler: Array<{ id: string; ad: string; kurumId: string }>;
  evrakAdaylari: Array<{ id: string; takipNo: string; kayitNo?: string | null; basvuruSahibiAdSoyad: string }>;
}

/**
 * Unified In-Place Full-Document WYSIWYG Workspace.
 * The entire A4 paper is a single continuous editable surface (Word/Google Docs style)
 * with authentic Tinos / Times New Roman typography, 10mm indent, and full justification.
 */
export function BelgeCalismaAlani({
  belge,
  model,
  turAdi,
  durum,
  kaynaklar,
  oneriler,
  onayAdimlari,
  yetkili,
  benimSiram,
  siradakiAdimId,
  digerBirimler,
  evrakAdaylari,
}: BelgeCalismaAlaniProps) {
  const [aktifSekme, setAktifSekme] = useState<"belge" | "oneriler" | "is_akisi" | "kaynaklar">("belge");
  const [olcek, setOlcek] = useState<number>(1);
  const [tamEkran, setTamEkran] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Send / Submit Dialog States
  const [gonderModalAcik, setGonderModalAcik] = useState(false);
  const [gonderAdSoyad, setGonderAdSoyad] = useState("");
  const [gonderIletisim, setGonderIletisim] = useState("");
  const [gonderYukleniyor, setGonderYukleniyor] = useState(false);
  const [gonderHata, setGonderHata] = useState<string | null>(null);
  const [gonderilenTakipNo, setGonderilenTakipNo] = useState<string | null>(null);

  const metinDuzenlenebilir = yetkili && belge.durum !== "onaylandi";
  const oneriBekliyor = oneriler.length > 0;

  async function handleGovdeKaydet(data: { govdeMetni: string; baslik?: string }) {
    await belgeMetniKaydet(belge.id, data);
  }

  function handleTamamla() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("govde_metni", belge.govdeMetni);
      formData.set("_tamamla", "1");
      await belgeGuncelle(belge.id, formData);
    });
  }

  async function handleDilekceGonder() {
    if (!gonderAdSoyad.trim() || !gonderIletisim.trim()) {
      setGonderHata("Lütfen Ad Soyad ve İletişim bilgilerini doldurun.");
      return;
    }
    setGonderHata(null);
    setGonderYukleniyor(true);
    try {
      const res = await basvuruGonder({
        dilekceMetni: belge.govdeMetni,
        basvuruSahibiAdSoyad: gonderAdSoyad.trim(),
        basvuruSahibiIletisim: gonderIletisim.trim(),
      });
      if (res.durum === "tamamlandi") {
        setGonderilenTakipNo(res.takipNo);
      } else {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("ebys_dilekce_taslak", belge.govdeMetni);
          window.location.href = `/basvuru?dilekce_aktarildi=1`;
        }
      }
    } catch (err) {
      setGonderHata(err instanceof Error ? err.message : "Gönderim sırasında hata oluştu.");
    } finally {
      setGonderYukleniyor(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-2.5 w-full", tamEkran && "fixed inset-0 z-50 bg-background p-4 sm:p-6 overflow-y-auto")}>
      {/* Top Document Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-primary/80 uppercase tracking-wider">{turAdi}</span>
            <Badge ton={durum.ton}>{durum.etiket}</Badge>
          </div>
          <h1 className="font-heading text-lg font-semibold text-foreground truncate">{belge.baslik}</h1>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {belge.belgeTuru === "dilekce" && (
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={() => {
                setGonderModalAcik(true);
                setGonderilenTakipNo(null);
                setGonderHata(null);
              }}
              className="h-7 text-xs gap-1.5 rounded-lg px-3 shadow-2xs font-semibold"
            >
              <PaperPlaneTilt size={13} weight="fill" />
              <span>Başvuruyu Gönder</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-7 text-xs gap-1.5 rounded-lg"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">Yazdır</span>
          </Button>

          <IndirmeButonlari temelHref={`/api/belge/${belge.id}/disa-aktar`} />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setTamEkran((prev) => !prev)}
            aria-label={tamEkran ? "Tam ekrandan çık" : "Tam ekran"}
            title={tamEkran ? "Tam ekrandan çık" : "Tam ekran"}
            className="rounded-lg size-7"
          >
            {tamEkran ? <ArrowsIn size={15} /> : <ArrowsOut size={15} />}
          </Button>
        </div>
      </div>

      {!yetkili && (
        <Card className="flex items-center gap-2 border-destructive-border bg-destructive-bg p-2 text-xs text-destructive">
          <XCircle size={15} weight="fill" className="shrink-0" aria-hidden="true" />
          <span>Bu belge biriminize ait değil — yalnızca görüntüleme yetkiniz bulunmaktadır.</span>
        </Card>
      )}

      {/* Tabs navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-1.5">
        <div className="flex flex-wrap items-center gap-1 bg-muted/40 p-0.5 rounded-lg">
          <button
            type="button"
            onClick={() => setAktifSekme("belge")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
              aktifSekme === "belge"
                ? "bg-card text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText size={13} className="text-primary" />
            <span>Resmi Belge</span>
          </button>

          {oneriler.length > 0 && (
            <button
              type="button"
              onClick={() => setAktifSekme("oneriler")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                aktifSekme === "oneriler"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkle size={13} weight="fill" className="text-amber-500" />
              <span>AI Önerileri</span>
              <span className="size-3.5 rounded-full bg-amber-500/20 text-amber-600 text-[9px] font-bold inline-flex items-center justify-center">
                {oneriler.length}
              </span>
            </button>
          )}

          {(onayAdimlari.length > 0 || yetkili) && (
            <button
              type="button"
              onClick={() => setAktifSekme("is_akisi")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                aktifSekme === "is_akisi"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GitFork size={13} className="text-primary" />
              <span>Onay & İş Akışı</span>
              {benimSiram && (
                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          )}

          {kaynaklar.length > 0 && (
            <button
              type="button"
              onClick={() => setAktifSekme("kaynaklar")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                aktifSekme === "kaynaklar"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Scales size={13} className="text-primary" />
              <span>Kaynaklar ({kaynaklar.length})</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {belge.belgeTuru === "dilekce" && (
            <Button
              type="button"
              size="sm"
              variant="brand"
              onClick={() => {
                setGonderModalAcik(true);
                setGonderilenTakipNo(null);
                setGonderHata(null);
              }}
              className="h-7 text-xs gap-1.5 rounded-lg px-2.5 shadow-2xs font-semibold"
            >
              <PaperPlaneTilt size={13} weight="fill" />
              <span>Başvuruyu Gönder</span>
            </Button>
          )}

          {aktifSekme === "belge" && yetkili && belge.durum === "taslak" && (
            <Button
              type="button"
              size="sm"
              variant="brand"
              disabled={isPending}
              onClick={handleTamamla}
              className="h-7 text-xs gap-1 rounded-lg px-2.5"
            >
              <CheckCircle size={14} aria-hidden="true" />
              <span>Taslağı Tamamla</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Tab: Single-Root Continuous Document Editor */}
      {aktifSekme === "belge" && (
        <GovdeEditoru
          key={belge.id}
          model={model}
          defaultValue={belge.govdeMetni}
          onKaydet={metinDuzenlenebilir ? handleGovdeKaydet : undefined}
          readOnly={!metinDuzenlenebilir}
          olcek={olcek}
          setOlcek={setOlcek}
        />
      )}

      {/* AI Suggestions Tab */}
      {aktifSekme === "oneriler" && (
        <div className="space-y-3">
          <h2 className="font-heading text-sm font-semibold text-foreground">
            Asistan Değişiklik Önerileri ({oneriler.length})
          </h2>
          {oneriler.map((oneri) => (
            <OneriIncelemesi
              key={oneri.id}
              oneri={oneri}
              guncelMetin={belge.govdeMetni}
              kabulEt={belgeOneriKarar.bind(null, belge.id, "kabul")}
              reddet={belgeOneriKarar.bind(null, belge.id, "red")}
              duzenlenebilir={yetkili}
            />
          ))}
        </div>
      )}

      {/* Workflow & Approval Tab */}
      {aktifSekme === "is_akisi" && (
        <div className="space-y-4">
          {yetkili && belge.durum === "tamamlandi" && (
            <Card className="flex flex-wrap items-center justify-between gap-3 border-info-border bg-info-bg p-4">
              <div>
                <p className="text-sm font-semibold text-primary">Belge Tamamlandı</p>
                <p className="text-xs text-primary/80">
                  {oneriBekliyor
                    ? "Onaya göndermeden önce bekleyen önerileri sonuçlandırın."
                    : "Belgeyi birim amirlerinin onay zincirine gönderebilirsiniz."}
                </p>
              </div>
              <form action={belgeyiOnayaGonder.bind(null, belge.id)}>
                <Button type="submit" disabled={oneriBekliyor} variant="brand" className="gap-1.5">
                  <PaperPlaneTilt size={16} aria-hidden="true" />
                  Onaya Gönder
                </Button>
              </form>
            </Card>
          )}

          {onayAdimlari.length > 0 && (
            <Card className="p-5 space-y-4">
              <h3 className="font-heading text-sm font-semibold text-foreground">Onay Zinciri Durumu</h3>
              <div className="space-y-2">
                {onayAdimlari.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/20">
                    <div className="flex items-center gap-2.5 text-sm">
                      {a.durum === "onaylandi" ? (
                        <CheckCircle size={18} weight="fill" className="text-emerald-500" aria-hidden="true" />
                      ) : a.durum === "bekliyor" ? (
                        <CircleDashed size={18} className="text-amber-500 animate-pulse" aria-hidden="true" />
                      ) : (
                        <XCircle size={18} weight="fill" className="text-destructive" aria-hidden="true" />
                      )}
                      <span className="font-medium text-foreground">{HIYERARSI_ETIKET[a.gerekliHiyerarsiSeviyesi]}</span>
                    </div>
                    <Badge variant={a.durum === "onaylandi" ? "default" : "secondary"}>{a.durum}</Badge>
                  </div>
                ))}
              </div>

              {benimSiram && siradakiAdimId !== undefined && (
                <div className="space-y-2 border-t border-border pt-4 mt-2">
                  <p className="text-sm font-semibold text-foreground">Bu adım sizin onayınızı bekliyor</p>
                  <div className="flex flex-wrap gap-2">
                    <form action={belgeOnayAdimiKarar.bind(null, belge.id, siradakiAdimId, "onaylandi")}>
                      <Button type="submit" variant="brand">
                        <CheckCircle size={16} aria-hidden="true" />
                        Onayla
                      </Button>
                    </form>
                    <form action={belgeOnayAdimiKarar.bind(null, belge.id, siradakiAdimId, "duzeltme_istendi")}>
                      <Button type="submit" variant="outline">
                        <ArrowUUpLeft size={16} aria-hidden="true" />
                        Düzeltme İste
                      </Button>
                    </form>
                    <form action={belgeOnayAdimiKarar.bind(null, belge.id, siradakiAdimId, "reddedildi")}>
                      <Button type="submit" variant="destructive">
                        <XCircle size={16} aria-hidden="true" />
                        Reddet
                      </Button>
                    </form>
                  </div>
                </div>
              )}
            </Card>
          )}

          {yetkili && digerBirimler.length > 0 && (
            <Card className="p-5 space-y-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ArrowsLeftRight size={16} className="text-primary" aria-hidden="true" />
                Başka bir kuruma/birime havale et
              </h3>
              <form action={belgeHavaleEt.bind(null, belge.id)} className="space-y-3">
                <select name="_hedef" className={`${inputClasses} bg-card`} required defaultValue="">
                  <option value="" disabled>
                    Kurum / birim seçin
                  </option>
                  {digerBirimler.map((b) => (
                    <option key={b.id} value={`${b.kurumId}|${b.id}`}>
                      {b.ad}
                    </option>
                  ))}
                </select>
                <input type="text" name="sebep" placeholder="Havale gerekçesi" className={inputClasses} />
                <Button type="submit" variant="outline" size="sm">
                  Havale Et
                </Button>
              </form>
            </Card>
          )}

          {yetkili && evrakAdaylari.length > 0 && (
            <Card className="p-5 space-y-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <LinkSimple size={16} className="text-primary" aria-hidden="true" />
                Bu belgeyi bir evrağa yanıt olarak bağla
              </h3>
              <p className="text-xs text-muted-foreground">
                Belge metni seçilen evrağın yanıt yazısı olarak kopyalanır ve evrak onay sürecine girer.
              </p>
              <div className="space-y-2">
                {evrakAdaylari.map((e) => (
                  <form key={e.id} action={belgeyiEvrakaYanitYap.bind(null, belge.id, e.id)} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2.5 bg-card">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{e.basvuruSahibiAdSoyad}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.takipNo} {e.kayitNo ? `· ${e.kayitNo}` : ""}
                      </p>
                    </div>
                    <Button type="submit" variant="outline" size="sm" className="shrink-0">
                      Bağla
                    </Button>
                  </form>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Sources Tab */}
      {aktifSekme === "kaynaklar" && kaynaklar.length > 0 && (
        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
            <Scales size={16} className="text-primary" aria-hidden="true" />
            Yasal Dayanak ve Mevzuat Kaynakları
          </h2>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {kaynaklar.map((k, i) => (
              <li key={i} className="p-2.5 rounded-lg border border-border/60 bg-muted/20">
                {k.link ? (
                  <Link href={k.link} className="font-semibold text-primary underline-offset-2 hover:underline">
                    {k.referans}
                  </Link>
                ) : (
                  <span className="font-semibold text-foreground">{k.referans}</span>
                )}
                {k.aciklama && <span className="block mt-1 text-zinc-600 dark:text-zinc-400">{k.aciklama}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Dilekçe Gönderim Dialog */}
      <Dialog open={gonderModalAcik} onOpenChange={setGonderModalAcik}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <PaperPlaneTilt size={20} weight="fill" className="text-primary" />
              {gonderilenTakipNo ? "Başvurunuz Alındı!" : "Dilekçeyi Resmi Olarak Gönder"}
            </DialogTitle>
            <DialogDescription>
              {gonderilenTakipNo
                ? "Resmi dilekçeniz sisteme başarıyla kaydedildi ve işlem sırasına alındı."
                : "Hazırladığınız resmi dilekçe e-Başvuru sistemine iletilecek ve yapay zekâ tarafından yetkili birime atanacaktır."}
            </DialogDescription>
          </DialogHeader>

          {gonderilenTakipNo ? (
            <div className="py-3 text-center space-y-4">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-bg text-success">
                <CheckCircle size={28} weight="fill" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Başvuru Takip Numaranız:</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-foreground">
                  {gonderilenTakipNo}
                </p>
              </div>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Bu numara ile başvurunuzun durumunu, ilgili birim kararını ve resmi yanıt yazısını takip edebilirsiniz.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 py-2">
              <div className="rounded-lg bg-muted/40 p-3 border border-border/60 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">{belge.baslik}</p>
                <p className="line-clamp-3 font-mono text-[11px] leading-relaxed opacity-90">{belge.govdeMetni}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Ad Soyad <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  required
                  value={gonderAdSoyad}
                  onChange={(e) => setGonderAdSoyad(e.target.value)}
                  placeholder="Adınız ve Soyadınız"
                  className={inputClasses}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">E-posta veya Telefon <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  required
                  value={gonderIletisim}
                  onChange={(e) => setGonderIletisim(e.target.value)}
                  placeholder="ornek@eposta.gov.tr veya 05XX XXX XX XX"
                  className={inputClasses}
                />
              </div>

              {gonderHata && (
                <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                  <XCircle size={14} weight="fill" aria-hidden="true" />
                  {gonderHata}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            {gonderilenTakipNo ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGonderModalAcik(false)}
                >
                  Kapat
                </Button>
                <Link href={`/basvuru/durum?takip=${gonderilenTakipNo}`}>
                  <Button variant="brand" size="sm" className="gap-1.5">
                    <span>Durumu Takip Et →</span>
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGonderModalAcik(false)}
                  disabled={gonderYukleniyor}
                >
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  onClick={handleDilekceGonder}
                  disabled={gonderYukleniyor || !gonderAdSoyad.trim() || !gonderIletisim.trim()}
                  className="gap-1.5 font-semibold"
                >
                  <PaperPlaneTilt size={14} weight="fill" />
                  {gonderYukleniyor ? "Başvuru Gönderiliyor..." : "Resmi Başvuruyu Gönder"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
