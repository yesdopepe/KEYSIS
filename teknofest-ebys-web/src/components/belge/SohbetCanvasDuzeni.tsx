"use client";

import { useState, type ReactNode } from "react";
import { FileText, X } from "@phosphor-icons/react/ssr";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMedyaSorgusu } from "@/lib/ui/medya-sorgusu";
import {
  Artifact,
  ArtifactHeader,
  ArtifactTitle,
  ArtifactDescription,
  ArtifactActions,
  ArtifactAction,
  ArtifactContent,
} from "@/components/ai-elements/artifact";

/**
 * The chat + document layout. Both slots are Server Components rendered by
 * the page above this one — this component only positions them, it never
 * reads or owns their data. When a tool call attaches a document mid-chat,
 * the chat client navigates (router.replace/refresh); that re-runs the
 * server page with a new `canvasSlot`, which flows back down here as a
 * fresh prop — this component doesn't participate in that update itself.
 *
 * The document itself is always wrapped in AI Elements' Artifact — the same
 * header/title/close-action shell on both breakpoints — rather than a plain
 * div on desktop and a bespoke Sheet header on mobile. That's also what
 * gives this a manual open/close: `acik` is real state (not just "does a
 * canvasSlot exist"), ArtifactAction's × closes it, and the floating pill
 * that appears in its place reopens it — on both breakpoints, not only
 * mobile, where closing used to be permanent for the rest of the session.
 *
 * Desktop: side-by-side resizable panes. Mobile: chat takes the full
 * width; the document opens in a Sheet instead of splitting an already
 * narrow screen in two. No document at all → the pane/pill simply isn't
 * rendered, chat gets the full width, no reserved dead space.
 *
 * The wide/narrow split is a media *query* rather than `md:` classes because
 * the two arrangements can't both be in the DOM: `chatSlot` owns the
 * composer, and a hidden second copy would duplicate its `asistan-girdi` and
 * `asistan-ek` ids — which is what decides where a `<label for>` points and
 * which file input the attach button opens.
 *
 * Height comes from the parent (SohbetDuzeni), which sizes itself to the
 * viewport — everything here is `h-full` so the thread scrolls inside its
 * own region rather than growing the page.
 */
export function SohbetCanvasDuzeni({
  chatSlot,
  canvasSlot,
  belgeBasligi,
  belgeAltBasligi,
  otomatikAcilsinMi,
}: {
  chatSlot: ReactNode;
  canvasSlot: ReactNode | null;
  /** Shown in the Artifact header (and as the mobile Sheet's a11y title). */
  belgeBasligi?: string;
  /** Shown under the title, e.g. the belge türü ("Tutanak") — omitted where
   *  the caller doesn't have it on hand. */
  belgeAltBasligi?: string;
  /** Flips false→true the moment a live draft first appears — opens the
   *  panel on its own instead of waiting for a tap on "Belgeyi Göster".
   *  Edge-triggered: closing it again mid-stream doesn't reopen it until a
   *  *new* draft starts. */
  otomatikAcilsinMi?: boolean;
}) {
  const [acik, setAcik] = useState(() => Boolean(canvasSlot || otomatikAcilsinMi));
  // Matches Tailwind's `md`. Server-rendered as wide: the pane layout is the
  // one this screen is designed around, and it degrades to a narrow viewport
  // far more gracefully than the reverse.
  const genisEkran = useMedyaSorgusu("(min-width: 48rem)", true);

  const [oncekiOtomatikAcilsinMi, setOncekiOtomatikAcilsinMi] = useState(otomatikAcilsinMi);
  if (otomatikAcilsinMi !== oncekiOtomatikAcilsinMi) {
    setOncekiOtomatikAcilsinMi(otomatikAcilsinMi);
    if (otomatikAcilsinMi) setAcik(true);
  }

  const [oncekiCanvasVarMi, setOncekiCanvasVarMi] = useState(Boolean(canvasSlot));
  const canvasVarMi = Boolean(canvasSlot);
  if (canvasVarMi !== oncekiCanvasVarMi) {
    setOncekiCanvasVarMi(canvasVarMi);
    if (canvasVarMi) setAcik(true);
  }

  // No document — chat gets the whole frame, no toggle, nothing to open.
  if (!canvasSlot) return <div className="h-full">{chatSlot}</div>;

  const panel = (
    <Artifact className="h-full rounded-none border-0 shadow-none">
      <ArtifactHeader>
        <div className="min-w-0">
          <ArtifactTitle className="truncate">{belgeBasligi ?? "Belge"}</ArtifactTitle>
          {belgeAltBasligi && <ArtifactDescription className="truncate">{belgeAltBasligi}</ArtifactDescription>}
        </div>
        <ArtifactActions>
          <ArtifactAction tooltip="Kapat" onClick={() => setAcik(false)}>
            <X size={16} aria-hidden="true" />
          </ArtifactAction>
        </ArtifactActions>
      </ArtifactHeader>
      <ArtifactContent className="overflow-y-auto">{canvasSlot}</ArtifactContent>
    </Artifact>
  );

  return (
    <div className="relative h-full">
      {genisEkran ? (
        acik ? (
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={55} minSize={30}>
              <div className="h-full">{chatSlot}</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={45} minSize={30}>
              {panel}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full">{chatSlot}</div>
        )
      ) : (
        <>
          <div className="h-full">{chatSlot}</div>
          <Sheet open={acik} onOpenChange={setAcik}>
            {/* Artifact's own header already has a close action, so the
                Sheet doesn't need a second one layered on top of it. */}
            <SheetContent side="right" className="w-full gap-0 border-0 p-0 sm:max-w-md" showCloseButton={false}>
              <SheetTitle className="sr-only">{belgeBasligi ?? "Belge"}</SheetTitle>
              {panel}
            </SheetContent>
          </Sheet>
        </>
      )}

      {!acik && (
        <button
          type="button"
          onClick={() => setAcik(true)}
          className="absolute end-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-md transition-colors hover:bg-muted"
        >
          <FileText size={14} aria-hidden="true" />
          Belgeyi Göster
        </button>
      )}
    </div>
  );
}
