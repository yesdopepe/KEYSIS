"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Submit button for the document upload forms, which are slow for honest
 * reasons: a scanned PDF goes through Docling OCR, then the text is split,
 * embedded and indexed. Minutes is normal for a large scan.
 *
 * Nothing used to say so — a plain submit button sat there looking inert
 * while the action ran, which reads as a frozen page and invites a second
 * submit. There is deliberately no client-side deadline: the message escalates
 * with elapsed time, and the work either finishes or fails with a real error.
 */
const ASAMALAR = [
  { saniye: 6, mesaj: "Bu işlem biraz sürebilir — dosyadan metin çıkarılıyor." },
  { saniye: 25, mesaj: "Metin çıkarıldı, parçalanıp indeksleniyor. Lütfen bekleyin." },
  {
    saniye: 75,
    mesaj:
      "Büyük ve taranmış belgelerde bu birkaç dakika sürebilir. Sayfayı kapatmayın; " +
      "işlem tamamlandığında liste güncellenecek.",
  },
];

export function YuklemeButonu({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  // Start time comes from the click rather than from an effect watching
  // `pending`, so the only state written while the upload runs is the tick.
  const [baslangic, setBaslangic] = useState<number | null>(null);
  const [simdi, setSimdi] = useState(0);

  useEffect(() => {
    if (!pending || baslangic === null) return;
    const sayac = setInterval(() => setSimdi(Date.now()), 1000);
    return () => clearInterval(sayac);
  }, [pending, baslangic]);

  const gecenSaniye =
    pending && baslangic !== null ? Math.max(0, Math.floor((simdi - baslangic) / 1000)) : 0;

  // Last stage whose threshold has passed.
  const asama = [...ASAMALAR].reverse().find((a) => gecenSaniye >= a.saniye);

  return (
    <div className="space-y-2">
      <Button
        type="submit"
        disabled={pending}
        onClick={() => {
          setBaslangic(Date.now());
          setSimdi(Date.now());
        }}
      >
        {pending ? (
          <>
            <Spinner className="size-4" />
            Yükleniyor…
          </>
        ) : (
          children
        )}
      </Button>

      {pending && asama && (
        <p
          aria-live="polite"
          className="flex items-start gap-1.5 rounded-[var(--radius-control)] border border-info-border bg-info-bg p-2.5 text-xs text-primary"
        >
          <span>{asama.mesaj}</span>
          <span className="ml-auto shrink-0 font-mono tabular-nums opacity-70">
            {Math.floor(gecenSaniye / 60)}:{String(gecenSaniye % 60).padStart(2, "0")}
          </span>
        </p>
      )}
    </div>
  );
}
