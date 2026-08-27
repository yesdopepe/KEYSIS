"use client";

import { useEffect, useState, useTransition } from "react";
import { belgeDetayGetirAction } from "@/app/panel/belge/actions";
import { BelgeCalismaAlani, type BelgeCalismaAlaniProps } from "@/components/belge/BelgeCalismaAlani";
import { Spinner } from "@/components/ui/spinner";
import { Card } from "@/components/ui/card";
import { WarningCircle } from "@phosphor-icons/react/ssr";

export interface BelgeTuvaliIstemciProps {
  belgeId: string;
  initialData?: BelgeCalismaAlaniProps | null;
}

export function BelgeTuvaliIstemci({ belgeId, initialData }: BelgeTuvaliIstemciProps) {
  const [data, setData] = useState<BelgeCalismaAlaniProps | null>(() => {
    if (initialData && initialData.belge.id === belgeId) {
      return initialData;
    }
    return null;
  });
  const [yukleniyor, setYukleniyor] = useState(!data);
  const [hata, setHata] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let iptal = false;

    if (initialData && initialData.belge.id === belgeId) {
      setData(initialData);
      setYukleniyor(false);
      return;
    }

    setYukleniyor(true);
    setHata(null);

    startTransition(async () => {
      try {
        const res = await belgeDetayGetirAction(belgeId);
        if (iptal) return;
        if (!res) {
          setHata("Belge bulunamadı veya erişim yetkiniz yok.");
        } else {
          setData(res);
        }
      } catch (err) {
        if (iptal) return;
        setHata(err instanceof Error ? err.message : "Belge yüklenirken bir hata oluştu.");
      } finally {
        if (!iptal) {
          setYukleniyor(false);
        }
      }
    });

    return () => {
      iptal = true;
    };
  }, [belgeId, initialData]);

  if (yukleniyor) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Spinner className="size-6 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Belge Düzenleyici Yükleniyor…</p>
          <p className="text-xs text-muted-foreground">Belge metni ve çalışma alanı hazırlanıyor.</p>
        </div>
      </div>
    );
  }

  if (hata || !data) {
    return (
      <Card className="flex items-start gap-3 border-destructive-border bg-destructive-bg p-4 text-xs text-destructive">
        <WarningCircle size={18} weight="fill" className="shrink-0 text-destructive mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-semibold">{hata ?? "Belge bulunamadı."}</p>
          <p className="mt-0.5 text-destructive/80">Lütfen belgenin silinmediğinden ve erişim yetkiniz olduğundan emin olun.</p>
        </div>
      </Card>
    );
  }

  return <BelgeCalismaAlani key={data.belge.id} {...data} />;
}
