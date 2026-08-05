import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  variant?: "surface" | "elevated";
  className?: string;
  hover?: boolean;
}

export function Card({
  children,
  variant = "surface",
  className = "",
  hover = false,
}: CardProps) {
  const baseClasses = "rounded-2xl border border-border p-6 transition-all duration-300";
  const variantClasses =
    variant === "elevated"
      ? "bg-surface-elevated shadow-elevated"
      : "bg-surface shadow-card";
  const hoverClasses = hover
    ? "hover:border-primary/40 hover:shadow-card cursor-pointer"
    : "";

  return (
    <div className={`${baseClasses} ${variantClasses} ${hoverClasses} ${className}`}>
      {children}
    </div>
  );
}

export type { CardProps };
