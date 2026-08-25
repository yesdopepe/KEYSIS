import { ClipboardText, Files, ChatCircleText, Books, Scales } from "@phosphor-icons/react/ssr";
import { AppShell, type NavItem } from "./AppShell";
import { BILGI_TABANI_MIN_SEVIYE, MEVZUAT_MIN_SEVIYE } from "@/lib/auth/seviyeler";

export function StaffShell({
  activeHref,
  children,
  session,
}: {
  activeHref: string;
  children: React.ReactNode;
  session: {
    adSoyad: string;
    unvan: string;
    birimAdi?: string;
    kurumAdi?: string;
    hiyerarsiSeviyesi?: number;
    bilgiTabaniYonetimi?: boolean;
    mevzuatYonetimi?: boolean;
  };
}) {
  const navItems: NavItem[] = [
    { href: "/panel", label: "Bekleyen İşler", icon: <ClipboardText size={18} /> },
    { href: "/panel/asistan", label: "Kurum Asistanı", icon: <ChatCircleText size={18} /> },
    { href: "/panel/belge", label: "Belgelerim", icon: <Files size={18} /> },
  ];

  // The knowledge base is curated, not crowd-sourced — only the level that
  // can issue a karar (or a role explicitly granted this) can decide what
  // the assistant answers from.
  if ((session.hiyerarsiSeviyesi ?? 0) >= BILGI_TABANI_MIN_SEVIYE || session.bilgiTabaniYonetimi) {
    navItems.push({
      href: "/panel/kurum-belgeleri",
      label: "Kurum Bilgi Tabanı",
      icon: <Books size={18} />,
    });
  }

  if ((session.hiyerarsiSeviyesi ?? 0) >= MEVZUAT_MIN_SEVIYE || session.mevzuatYonetimi) {
    navItems.push({
      href: "/panel/mevzuat",
      label: "Mevzuat",
      icon: <Scales size={18} />,
    });
  }

  return (
    <AppShell navItems={navItems} activeHref={activeHref} session={session}>
      {children}
    </AppShell>
  );
}
