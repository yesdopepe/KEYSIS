import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariant, type ButtonSize } from "./button-variants";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
