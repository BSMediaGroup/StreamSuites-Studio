import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

type ButtonVariant = "primary" | "secondary" | "quiet";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
}

interface ButtonLinkProps {
  readonly children: ReactNode;
  readonly to: string;
  readonly variant?: ButtonVariant;
}

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`button button--${variant} ${className}`.trim()}
      type={type}
      {...props}
    />
  );
}

export function ButtonLink({ children, to, variant = "primary" }: ButtonLinkProps) {
  return (
    <Link className={`button button--${variant}`} to={to}>
      {children}
    </Link>
  );
}
