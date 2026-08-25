"use client";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import {
  CheckCircle,
  ChevronDown,
  Circle,
  Clock,
  Wrench,
  XCircle,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("group not-prose mb-3 w-full rounded-xl border border-border bg-card/60 overflow-hidden shadow-xs", className)}
    {...props}
  />
);

export type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolHeaderProps = {
  title?: string;
  className?: string;
} & (
  | { type: ToolUIPart["type"]; state: ToolUIPart["state"]; toolName?: never }
  | {
      type: DynamicToolUIPart["type"];
      state: DynamicToolUIPart["state"];
      toolName: string;
    }
);

const statusLabels: Record<ToolPart["state"], string> = {
  "approval-requested": "Onay Bekleniyor",
  "approval-responded": "Yanıtlandı",
  "input-available": "Çalışıyor",
  "input-streaming": "Hazırlanıyor",
  "output-available": "Tamamlandı",
  "output-denied": "Reddedildi",
  "output-error": "Hata",
};

const statusIcons: Record<ToolPart["state"], ReactNode> = {
  "approval-requested": <Clock className="size-3.5 text-amber-500" />,
  "approval-responded": <CheckCircle className="size-3.5 text-primary" />,
  "input-available": <Clock className="size-3.5 animate-pulse text-primary" />,
  "input-streaming": <Circle className="size-3.5 text-muted-foreground" />,
  "output-available": <CheckCircle className="size-3.5 text-emerald-600" />,
  "output-denied": <XCircle className="size-3.5 text-rose-500" />,
  "output-error": <XCircle className="size-3.5 text-destructive" />,
};

export const getStatusBadge = (status: ToolPart["state"]) => (
  <Badge className="gap-1 rounded-full text-[0.6875rem] py-0 px-2 font-normal" variant="secondary">
    {statusIcons[status]}
    <span>{statusLabels[status]}</span>
  </Badge>
);

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  toolName,
  ...props
}: ToolHeaderProps) => {
  const derivedName =
    type === "dynamic-tool" ? toolName : type.split("-").slice(1).join("-");

  return (
    <CollapsibleTrigger
      className={cn(
        "flex w-full items-center justify-between gap-3 p-2.5 text-xs transition-colors hover:bg-muted/40 cursor-pointer",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <Wrench className="size-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground">{title ?? derivedName}</span>
        {getStatusBadge(state)}
      </div>
      <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-200 in-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "space-y-2 border-t border-border/60 bg-muted/20 p-3 text-xs",
      className
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-1 overflow-hidden", className)} {...props}>
    <h4 className="font-semibold text-muted-foreground text-[0.6875rem] uppercase tracking-wider">
      Parametreler
    </h4>
    <pre className="overflow-x-auto rounded-lg bg-muted/60 p-2 text-[0.75rem] font-mono text-foreground leading-relaxed">
      {JSON.stringify(input, null, 2)}
    </pre>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ToolPart["output"];
  errorText: ToolPart["errorText"];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  let Output: ReactNode = <div>{output as ReactNode}</div>;

  if (typeof output === "object" && !isValidElement(output)) {
    Output = (
      <pre className="overflow-x-auto rounded-lg bg-muted/60 p-2 text-[0.75rem] font-mono text-foreground leading-relaxed">
        {JSON.stringify(output, null, 2)}
      </pre>
    );
  } else if (typeof output === "string") {
    Output = (
      <pre className="overflow-x-auto rounded-lg bg-muted/60 p-2 text-[0.75rem] font-mono text-foreground leading-relaxed">
        {output}
      </pre>
    );
  }

  return (
    <div className={cn("space-y-1", className)} {...props}>
      <h4 className="font-semibold text-muted-foreground text-[0.6875rem] uppercase tracking-wider">
        {errorText ? "Hata" : "Sonuç"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-lg text-xs",
          errorText
            ? "bg-destructive/10 text-destructive p-2"
            : "text-foreground"
        )}
      >
        {errorText && <div>{errorText}</div>}
        {Output}
      </div>
    </div>
  );
};
