"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Button that disables itself and shows a spinner while its parent <form> is submitting. */
export function SubmitButton({ children, disabled, ...props }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending && <Spinner />}
      {children}
    </Button>
  );
}
