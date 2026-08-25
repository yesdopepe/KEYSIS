"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { BookOpen, ChevronDown, FileText } from "lucide-react";
import type { ComponentProps } from "react";
import Link from "next/link";

export type SourcesProps = ComponentProps<"div">;

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible
    className={cn("not-prose mb-3 text-xs", className)}
    {...props}
  />
);

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};

export const SourcesTrigger = ({
  className,
  count,
  children,
  ...props
}: SourcesTriggerProps) => (
  <CollapsibleTrigger
    className={cn(
      "flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer font-medium",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        <BookOpen className="size-3.5 text-primary" />
        <span>{count} kaynak kullanıldı</span>
        <ChevronDown className="size-3 transition-transform duration-200 in-data-[state=open]:rotate-180" />
      </>
    )}
  </CollapsibleTrigger>
);

export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>;

export const SourcesContent = ({
  className,
  ...props
}: SourcesContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-2 flex w-fit flex-col gap-1.5 ps-2 border-s-2 border-primary/20",
      className
    )}
    {...props}
  />
);

export type SourceProps = ComponentProps<"a"> & {
  title?: string;
  isInternal?: boolean;
};

export const Source = ({ href, title, isInternal = true, children, ...props }: SourceProps) => {
  const content = children ?? (
    <>
      <FileText className="size-3 text-primary/70 shrink-0" />
      <span className="truncate font-medium text-foreground hover:underline">{title}</span>
    </>
  );

  if (href && isInternal && href.startsWith("/")) {
    return (
      <Link
        className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground py-0.5"
        href={href}
      >
        {content}
      </Link>
    );
  }

  return (
    <a
      className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground py-0.5"
      href={href}
      rel="noreferrer"
      target="_blank"
      {...props}
    >
      {content}
    </a>
  );
};
