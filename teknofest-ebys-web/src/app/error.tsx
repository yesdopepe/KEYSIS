"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Warning, ArrowClockwise } from "@phosphor-icons/react/ssr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buttonClasses } from "@/components/ui/button-variants";

/**
 * Route-level error boundary.
 *
 * Without one, an uncaught Server Action or render error takes the whole page
 * down to Next's built-in 500 page. In development the message is on screen; in
 * a production build it is stripped to `digest`, which is exactly how a refusal
 * as ordinary as "this belge is not finished yet" reached the browser as a bare
 * HTTP 500. Expected refusals are returned as data now (see
 * panel/belge/actions.ts); what still lands here is a real defect, so show the
 * digest — it is the only handle a user can quote that matches a server log
 * line, and every action in that path now logs one.
 */
export default function Hata({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Sayfa hatası:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-16">
      <Card className="w-full space-y-4 p-6">
        <div className="flex items-center gap-2.5">
          <Warning size={22} weight="fill" className="text-destructive" aria-hidden="true" />
          <h1 className="font-heading text-lg font-semibold text-foreground">
            Bir şeyler ters gitti
          </h1>
        </div>

        <p className="text-sm text-muted-foreground">
          İşlem tamamlanamadı. Tekrar denemek sorunu çözmezse, aşağıdaki hata
          kodunu sistem yöneticinize iletin.
        </p>

        {error.digest && (
          <p className="rounded-control border border-border/60 bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
            Hata kodu: {error.digest}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={reset} variant="brand" className="gap-1.5">
            <ArrowClockwise size={16} aria-hidden="true" />
            Tekrar dene
          </Button>
          <Link href="/panel" className={buttonClasses("outline")}>
            Panele dön
          </Link>
        </div>
      </Card>
    </main>
  );
}
