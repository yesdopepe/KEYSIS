"use client";

import { useState, type ReactNode, useSyncExternalStore, useCallback } from "react";
import { Sidebar, List, Plus } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SohbetListesi, type SohbetOzeti } from "@/app/panel/asistan/sohbet-listesi";
import { cn } from "@/lib/utils";

function subscribeToSidebarStore(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("asistan_sidebar_degisti", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("asistan_sidebar_degisti", callback);
  };
}

function getSidebarSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const saved = localStorage.getItem("asistan_sidebar_acik");
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

function getSidebarServerSnapshot(): boolean {
  return true;
}

/**
 * Modern AI Chat Layout with Collapsible Conversation Sidebar.
 * Follows AI SDK Elements & modern AI Assistant interface guidelines.
 */
export function SohbetDuzeni({
  sohbetler,
  aktifId,
  baslik,
  baseHref = "/panel/asistan",
  children,
}: {
  sohbetler: SohbetOzeti[];
  aktifId?: string;
  baslik?: string;
  baseHref?: string;
  children: ReactNode;
}) {
  const [listeAcik, setListeAcik] = useState(false);
  const sidebarAcik = useSyncExternalStore(
    subscribeToSidebarStore,
    getSidebarSnapshot,
    getSidebarServerSnapshot
  );

  const toggleSidebar = useCallback(() => {
    try {
      const suanki = getSidebarSnapshot();
      localStorage.setItem("asistan_sidebar_acik", String(!suanki));
      window.dispatchEvent(new Event("asistan_sidebar_degisti"));
    } catch {
      // ignore
    }
  }, []);

  return (
    <main className="flex h-[calc(100dvh-3.5rem)] w-full md:h-dvh overflow-hidden bg-background">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-e border-border/70 bg-card/60 backdrop-blur-sm transition-all duration-300 ease-in-out md:flex md:flex-col overflow-hidden",
          sidebarAcik ? "w-72 opacity-100" : "w-0 border-none opacity-0 pointer-events-none"
        )}
      >
        <div className="w-72 h-full flex flex-col min-w-[18rem]">
          <SohbetListesi sohbetler={sohbetler} aktifId={aktifId} baseHref={baseHref} />
        </div>
      </aside>

      {/* Main Chat Thread Area */}
      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-card/40 backdrop-blur-md px-3 md:h-13 md:px-4">
          <div className="flex items-center gap-2 min-w-0">
            {/* Mobile Sheet Trigger */}
            <button
              type="button"
              onClick={() => setListeAcik(true)}
              aria-label="Sohbet geçmişini aç"
              className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            >
              <List size={18} aria-hidden="true" />
            </button>

            {/* Desktop Collapsible Sidebar Toggle */}
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={sidebarAcik ? "Geçmişi Gizle" : "Geçmişi Göster"}
              title={sidebarAcik ? "Geçmişi Gizle" : "Geçmişi Göster"}
              className={cn(
                "hidden md:flex size-8 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground border border-border/50",
                !sidebarAcik && "text-primary border-primary/30 bg-primary/5"
              )}
            >
              <Sidebar size={16} aria-hidden="true" />
            </button>

            {!sidebarAcik && (
              <Link
                href={baseHref}
                className="hidden md:flex h-7 px-2 text-xs gap-1.5 rounded-lg items-center text-muted-foreground hover:text-foreground hover:bg-muted font-medium transition-colors"
              >
                <Plus size={13} className="text-primary" />
                <span>Yeni Sohbet</span>
              </Link>
            )}

            <div className="h-3.5 w-px bg-border/60 hidden md:block" />

            <h1 className="truncate font-heading text-xs sm:text-sm font-semibold text-foreground">
              {baslik ?? "Kurum Asistanı"}
            </h1>
          </div>
        </header>

        <div className="min-h-0 flex-1 relative overflow-hidden">{children}</div>
      </div>

      {/* Mobile Drawer Sheet */}
      <Sheet open={listeAcik} onOpenChange={setListeAcik}>
        <SheetContent side="left" className="w-80 gap-0 p-0">
          <SheetTitle className="sr-only">Sohbetler</SheetTitle>
          <SohbetListesi
            sohbetler={sohbetler}
            aktifId={aktifId}
            baseHref={baseHref}
            onSecim={() => setListeAcik(false)}
          />
        </SheetContent>
      </Sheet>
    </main>
  );
}
