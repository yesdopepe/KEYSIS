"use client";

import { useState } from "react";
import { PencilSimpleLine, Sparkle, FloppyDisk, WarningCircle } from "@phosphor-icons/react/ssr";
import type { ResmiBelge } from "@/lib/belgeler/resmi-belge";
import type { YanitTaslagi } from "@/lib/belgeler/yanit-taslagi";
import type { OneriKaydi } from "@/lib/belgeler/oneriler";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BelgeSayfaCercevesi } from "@/components/belge/BelgeSayfaCercevesi";
import { IndirmeMenusu } from "@/components/belge/IndirmeMenusu";
import { OneriIncelemesi } from "@/components/belge/OneriIncelemesi";
import { ResmiBelgeOnizleme } from "@/components/belge/ResmiBelgeOnizleme";

export interface CevapYazisiPaneliProps {
  taslak: YanitTaslagi;
  model: ResmiBelge;
  oneriler: OneriKaydi[];
  duzenlenebilir: boolean;
  disaAktarHref: string;
  kaydet: (formData: FormData) => Promise<void>;
  revizyonIste: (formData: FormData) => Promise<void>;
  oneriKabul: (formData: FormData) => void;
  oneriRed: (formData: FormData) => void;
}

/**
 * The response letter as one thing: the finished page, full card width.
 * Everything that acts *on* the letter — the field editor, the AI revision
 * request, the pending suggestions — sits behind a toolbar button, because
 * side by side they left the document itself in a half-width column far too
 * narrow for an A4 sheet to render in.
 */
export function CevapYazisiPaneli({
  taslak,
  model,
  oneriler,
  duzenlenebilir,
  disaAktarHref,
  kaydet,
  revizyonIste,
  oneriKabul,
  oneriRed,
}: CevapYazisiPaneliProps) {
  const [duzenleAcik, setDuzenleAcik] = useState(false);
  const [revizyonAcik, setRevizyonAcik] = useState(false);
  const [onerilerAcik, setOnerilerAcik] = useState(false);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-foreground">
            <PencilSimpleLine size={17} className="text-primary" aria-hidden="true" />
            Cevap Yazısı
          </h2>
          {taslak.konu && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={taslak.konu}>
              {taslak.konu}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {oneriler.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setOnerilerAcik(true)}>
              <Sparkle size={16} weight="fill" className="text-warning" aria-hidden="true" />
              Öneriler
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-warning-bg text-[10px] font-bold text-warning">
                {oneriler.length}
              </span>
            </Button>
          )}
          {duzenlenebilir && (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setDuzenleAcik(true)}>
                <PencilSimpleLine size={16} aria-hidden="true" />
                Düzenle
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => setRevizyonAcik(true)}>
                <Sparkle size={16} aria-hidden="true" />
                AI Revizyon
              </Button>
            </>
          )}
          <IndirmeMenusu temelHref={disaAktarHref} />
        </div>
      </div>

      {oneriler.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning-border bg-warning-bg px-5 py-2.5">
          <p className="flex items-center gap-1.5 text-xs text-warning">
            <WarningCircle size={15} weight="fill" aria-hidden="true" />
            {oneriler.length} bekleyen değişiklik önerisi yazıya işlenmeden onayınızı bekliyor.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setOnerilerAcik(true)}>
            İncele
          </Button>
        </div>
      )}

      {!duzenlenebilir && (
        <p className="border-b border-border px-5 py-2.5 text-xs text-muted-foreground">
          Bu aşamada yazı düzenlenemez. Düzenleme, taslak hazırlama ve onay zinciri aşamalarında
          ilgili birim tarafından yapılabilir.
        </p>
      )}

      <div className="bg-muted p-4 sm:p-6">
        <BelgeSayfaCercevesi>
          <ResmiBelgeOnizleme belge={model} />
        </BelgeSayfaCercevesi>
      </div>

      {/* Yazıyı düzenle */}
      <Dialog open={duzenleAcik} onOpenChange={setDuzenleAcik}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cevap yazısını düzenle</DialogTitle>
            <DialogDescription>
              Konu ve muhatap satırları antette görünür; ilgi satırı, gövde ve kapanış tek bir yazı
              olarak düzenlenir.
            </DialogDescription>
          </DialogHeader>
          <form
            action={async (formData) => {
              await kaydet(formData);
              setDuzenleAcik(false);
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Konu" htmlFor="konu">
                <Input id="konu" name="konu" defaultValue={taslak.konu} className="mt-1.5 h-9" />
              </Field>
              <Field label="Muhatap" htmlFor="hitap">
                <Input id="hitap" name="hitap" defaultValue={taslak.hitap} className="mt-1.5 h-9" />
              </Field>
            </div>
            <Field
              label="Yazı Metni"
              htmlFor="govde_metni"
              hint="İlgi satırı, gövde ve kapanış dahil, tek bir yazı olarak düzenleyin."
            >
              <Textarea
                id="govde_metni"
                name="govde_metni"
                defaultValue={taslak.govdeMetni}
                rows={16}
                className="mt-1.5 max-h-[45vh] font-belge leading-relaxed"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDuzenleAcik(false)}>
                Vazgeç
              </Button>
              <Button type="submit">
                <FloppyDisk size={18} aria-hidden="true" />
                Yazıyı Kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Yapay zekâdan revizyon iste */}
      <Dialog open={revizyonAcik} onOpenChange={setRevizyonAcik}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Yapay zekâdan revizyon iste</DialogTitle>
            <DialogDescription>
              Öneri yazıya doğrudan işlenmez; değişikliği karşılaştırmalı görüp onaylarsınız.
            </DialogDescription>
          </DialogHeader>
          <form
            action={async (formData) => {
              await revizyonIste(formData);
              setRevizyonAcik(false);
            }}
            className="space-y-4"
          >
            <Field
              label="Ne değişsin?"
              htmlFor="talimat"
              hint="İsteğe bağlı — boş bırakırsanız yazı genel olarak gözden geçirilir."
            >
              <Input
                id="talimat"
                name="talimat"
                placeholder="örn. Kapanış cümlesi daha resmi olsun"
                className="mt-1.5 h-9"
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRevizyonAcik(false)}>
                Vazgeç
              </Button>
              <Button type="submit" variant="secondary">
                <Sparkle size={18} aria-hidden="true" />
                Öneri Hazırla
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bekleyen öneriler */}
      <Dialog open={onerilerAcik} onOpenChange={setOnerilerAcik}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bekleyen değişiklik önerileri ({oneriler.length})</DialogTitle>
            <DialogDescription>
              Yeşil eklenen, kırmızı çıkarılan metni gösterir. Kabul ettiğinizde yazı güncellenir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {oneriler.length === 0 && (
              // Reachable without closing: accepting the last suggestion
              // revalidates the page underneath the open dialog.
              <p className="py-6 text-sm text-muted-foreground">Bekleyen öneri kalmadı.</p>
            )}
            {oneriler.map((oneri) => (
              <OneriIncelemesi
                key={oneri.id}
                oneri={oneri}
                guncelMetin={taslak.govdeMetni}
                kabulEt={oneriKabul}
                reddet={oneriRed}
                duzenlenebilir={duzenlenebilir}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
