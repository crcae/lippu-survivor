import { Trophy } from "lucide-react";

interface FootballIconProps {
  className?: string;
  strokeWidth?: number;
}

/**
 * Pro-grade League Trophy & Sports Icon component.
 * Used across navigation, badges, headers, and landing cards.
 */
export function FootballIcon({
  className = "w-5 h-5",
  strokeWidth = 2,
}: FootballIconProps) {
  return <Trophy className={className} strokeWidth={strokeWidth} />;
}

export type { FootballIconProps };
