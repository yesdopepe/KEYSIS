import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Kept deliberately unpadded/ungapped — every existing call site supplies
 * its own p-4/p-5, unlike shadcn's default Card (`flex flex-col gap-6
 * py-6`). Adopting shadcn's defaults here would silently reflow every card
 * in the app. New code should compose CardHeader/CardContent below instead
 * of passing ad hoc padding to this one.
 */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  );
}

// shadcn's sub-components, unmodified — for new Phase 2+ UI that wants the
// full Card composition rather than a bare div + manual padding.
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col gap-1.5 px-5 pt-5", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-title"
      className={cn("font-heading text-base leading-snug font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export function CardAction({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cn("px-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-2 px-5 pb-5", className)}
      {...props}
    />
  );
}
