import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface LogoProps {
  variant?: "full" | "icon";
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  linkToHome?: boolean;
  priority?: boolean;
}

const SIZE_CLASSES: Record<"full" | "icon", Record<"sm" | "md" | "lg" | "xl" | "2xl", string>> = {
  full: {
    sm: "h-8 w-auto min-h-[32px]",
    md: "h-10 w-auto min-h-[40px]",
    lg: "h-12 w-auto min-h-[48px]",
    xl: "h-14 w-auto min-h-[56px]",
    "2xl": "h-20 w-auto min-h-[80px]",
  },
  icon: {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-14 w-14",
    "2xl": "h-20 w-20",
  },
};

export function Logo({
  variant = "full",
  size = "md",
  className,
  linkToHome = true,
  priority = true,
}: LogoProps) {
  const isFull = variant === "full";
  const src = isFull ? "/logo.png" : "/icon.png";
  const alt = isFull ? "KEYSİS — Kapsamlı Evrak Yönetim Sistemi" : "KEYSİS";
  const width = isFull ? 320 : 80;
  const height = isFull ? 120 : 80;

  const content = (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      className={cn(
        "object-contain select-none transition-all dark:brightness-0 dark:invert",
        SIZE_CLASSES[variant][size],
        className
      )}
    />
  );

  if (linkToHome) {
    return (
      <Link
        href="/"
        className="inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[var(--radius-control)] hover:opacity-90 transition-opacity"
        aria-label="KEYSİS Ana Sayfa"
      >
        {content}
      </Link>
    );
  }

  return content;
}
