"use client";

import { cn } from "@/lib/utils";
import type { ElementType, ReactNode } from "react";
import { memo } from "react";

export interface TextShimmerProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  duration?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = "span",
  className,
}: TextShimmerProps) => {
  return (
    <Component
      className={cn(
        "inline-flex items-center gap-1.5 shimmer text-muted-foreground",
        className
      )}
    >
      {children}
    </Component>
  );
};

export const Shimmer = memo(ShimmerComponent);
