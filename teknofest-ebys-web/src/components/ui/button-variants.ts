import { cva, type VariantProps } from "class-variance-authority";

/**
 * Kept as hand-tuned solid-color variants rather than adopting shadcn's
 * default cva output verbatim — this project's palette (see globals.css) is
 * a deliberate single-light-theme government portal look, not shadcn's
 * neutral starting point. The 44px WCAG touch-target floor lives on each
 * text size individually (not the shared base) so a small square icon
 * button isn't forced to the same minimum height — min-height wins over a
 * shorter `size-*` height in CSS, which would otherwise stretch it.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold " +
    "transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 " +
    "focus-visible:outline-none",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary hover:bg-primary-hover",
        secondary: "bg-card text-primary border border-primary hover:bg-info-bg",
        brand: "bg-brand text-brand-foreground hover:bg-brand-hover",
        // Deprecated alias: every existing call site says variant="accent"
        // meaning "the green button" (from back when --color-accent *was*
        // the brand green). Kept identical to "brand" so those call sites
        // never needed to change and render exactly as before.
        accent: "bg-brand text-brand-foreground hover:bg-brand-hover",
        destructive: "bg-destructive text-on-destructive hover:bg-destructive-hover",
        outline: "bg-transparent text-foreground border border-border hover:bg-muted",
        ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      },
      size: {
        md: "min-h-11 px-5 py-2.5 text-sm",
        sm: "min-h-11 px-3.5 py-2 text-sm",
        // Square icon-only sizes — used by shadcn-generated components
        // (Dialog/Sheet close buttons), not by hand-authored app code, which
        // instead sizes its icon via the Phosphor <Icon size={n}> prop.
        icon: "size-11 p-0",
        "icon-sm": "size-9 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>;

/** For Link-as-button call sites that can't render the Button component itself. */
export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = "") {
  return buttonVariants({ variant, size, className });
}
