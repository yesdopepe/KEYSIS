export type ButtonVariant = "primary" | "secondary" | "accent" | "destructive" | "outline" | "ghost";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold " +
  "transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 " +
  "min-h-11";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "bg-card text-primary border border-primary hover:bg-info-bg",
  accent: "bg-accent text-on-accent hover:bg-accent-hover",
  destructive: "bg-destructive text-on-destructive hover:bg-destructive-hover",
  outline: "bg-transparent text-foreground border border-border hover:bg-muted",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
};

const SIZES: Record<ButtonSize, string> = {
  md: "px-5 py-2.5 text-sm",
  sm: "px-3.5 py-2 text-sm",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = "") {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`.trim();
}
