import { FilePlus, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { AppShell, type NavItem } from "./AppShell";

const NAV_ITEMS: NavItem[] = [
  { href: "/basvuru", label: "Yeni Başvuru", icon: <FilePlus size={18} /> },
  { href: "/basvuru/durum", label: "Durum Sorgula", icon: <MagnifyingGlass size={18} /> },
];

export function PublicShell({ activeHref, children }: { activeHref: string; children: React.ReactNode }) {
  return (
    <AppShell navItems={NAV_ITEMS} activeHref={activeHref}>
      {children}
    </AppShell>
  );
}
