import type { ReactNode } from "react";

export const inputClasses =
  "mt-1.5 w-full rounded-[var(--radius-control)] border border-border bg-card px-3.5 py-2.5 " +
  "text-sm text-foreground placeholder:text-muted-foreground " +
  "focus:border-primary focus-visible:outline-none transition-colors min-h-11";

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

/** Label + control + optional hint/error, wired with aria-describedby per WCAG guidance. */
export function Field({ label, htmlFor, hint, error, required, children }: FieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-foreground">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {hint && (
        <p id={hintId} className="mt-0.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
