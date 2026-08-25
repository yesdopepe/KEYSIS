import type { ButtonHTMLAttributes } from "react";
import { buttonClasses, type ButtonVariant, type ButtonSize } from "./button-variants";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return <button className={buttonClasses(variant, size, className)} {...props} />;
}
