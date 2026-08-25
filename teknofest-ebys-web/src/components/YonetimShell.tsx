import { SquaresFour, Buildings, UsersThree } from "@phosphor-icons/react/ssr";
import { AppShell, type NavItem } from "./AppShell";

const NAV_ITEMS: NavItem[] = [
  { href: "/yonetim", label: "Genel Bakış", icon: <SquaresFour size={18} /> },
  { href: "/yonetim/kurumlar", label: "Kurumlar", icon: <Buildings size={18} /> },
  { href: "/yonetim/roller", label: "Roller", icon: <UsersThree size={18} /> },
];

/**
 * The super-admin shell. Deliberately separate from StaffShell rather than
 * reused — the audience and nav items have nothing in common, and a
 * sistemYoneticisiMi account's own kurum/birim attachment is a placeholder
 * (see lib/db/seed.ts), so unlike StaffShell's session prop this never
 * shows birimAdi/kurumAdi.
 */
export function YonetimShell({
  activeHref,
  children,
  adSoyad,
}: {
  activeHref: string;
  children: React.ReactNode;
  adSoyad: string;
}) {
  return (
    <AppShell navItems={NAV_ITEMS} activeHref={activeHref} session={{ adSoyad, unvan: "Sistem Yöneticisi" }}>
      {children}
    </AppShell>
  );
}
