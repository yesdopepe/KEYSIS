"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { List, X, SignOut } from "@phosphor-icons/react/ssr";
import { cikisYap } from "@/app/giris/actions";
import { TemaDegistirici } from "@/components/tema/tema-degistirici";
import { Logo } from "@/components/Logo";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

interface AppShellProps {
  navItems: NavItem[];
  activeHref: string;
  children: ReactNode;
  /** Staff session summary — omit for the public/citizen shell. */
  session?: {
    adSoyad: string;
    unvan: string;
    birimAdi?: string;
    kurumAdi?: string;
  };
}

export function AppShell({ navItems, activeHref, children, session }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-1">
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <Logo variant="full" size="md" />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Menüyü aç"
          aria-expanded={mobileOpen}
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-foreground hover:bg-muted cursor-pointer"
        >
          <List size={22} aria-hidden="true" />
        </button>
      </div>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-card transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-18 md:h-20 items-center justify-between border-b border-border px-4 py-3">
          <Logo variant="full" size="xl" className="max-w-[190px]" />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Menüyü kapat"
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted cursor-pointer md:hidden"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map((item) => {
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-info-bg text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-3 border-t border-border p-3">
          <TemaDegistirici />
          {session ? (
            <div className="rounded-[var(--radius-control)] bg-muted p-3">
              <p className="truncate text-sm font-semibold text-foreground">{session.adSoyad}</p>
              <p className="truncate text-xs text-muted-foreground">
                {session.unvan}
                {session.birimAdi ? ` · ${session.birimAdi}` : ""}
              </p>
              {session.kurumAdi && (
                <p className="truncate text-xs text-muted-foreground">{session.kurumAdi}</p>
              )}
              <form action={cikisYap} className="mt-2.5">
                <button
                  type="submit"
                  className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-card hover:text-foreground cursor-pointer transition-colors"
                >
                  <SignOut size={15} aria-hidden="true" />
                  Çıkış Yap
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/giris"
              className="flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Personel Girişi
            </Link>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="min-w-0 flex-1 pt-16 md:pt-0">{children}</div>
    </div>
  );
}
