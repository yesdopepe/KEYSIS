import type { DurumTon } from "@/lib/ui/durum";

const TON_SINIFLARI: Record<DurumTon, string> = {
  notr: "bg-muted text-muted-foreground border-border",
  bilgi: "bg-info-bg text-info border-info-border",
  uyari: "bg-warning-bg text-warning border-warning-border",
  basari: "bg-success-bg text-success border-success-border",
  tehlike: "bg-destructive-bg text-destructive border-destructive-border",
};

export function Badge({ ton, children }: { ton: DurumTon; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${TON_SINIFLARI[ton]}`}
    >
      {children}
    </span>
  );
}
