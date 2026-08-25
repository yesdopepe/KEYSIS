import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DurumTon } from "@/lib/ui/durum";

const BASE = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold";

// Turkish status tones — every existing call site (<Badge ton="basari">).
const TON_SINIFLARI: Record<DurumTon, string> = {
  notr: "bg-muted text-muted-foreground border-border",
  bilgi: "bg-info-bg text-info border-info-border",
  uyari: "bg-warning-bg text-warning border-warning-border",
  basari: "bg-success-bg text-success border-success-border",
  tehlike: "bg-destructive-bg text-destructive border-destructive-border",
};

// shadcn-style variants for new code with no Turkish-status concept (e.g.
// chat tool-call chips) — a plain neutral/primary badge, not a status one.
type BadgeVariant = "default" | "secondary" | "outline";
const VARYANT_SINIFLARI: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-on-primary",
  secondary: "border-transparent bg-muted text-muted-foreground",
  outline: "border-border text-foreground",
};

type BadgeProps = { className?: string; children: ReactNode } & (
  | { ton: DurumTon; variant?: never }
  | { ton?: never; variant?: BadgeVariant }
);

export function Badge({ className, children, ...props }: BadgeProps) {
  const tone = "ton" in props && props.ton ? TON_SINIFLARI[props.ton] : VARYANT_SINIFLARI[props.variant ?? "default"];
  return <span className={cn(BASE, tone, className)}>{children}</span>;
}
