import type { NFLTeam } from "@/types";

type TeamMarkSize = "xs" | "sm" | "md" | "lg" | "xl";

interface TeamMarkProps {
  team: NFLTeam;
  size?: TeamMarkSize;
  className?: string;
}

const sizeClasses: Record<TeamMarkSize, string> = {
  xs: "w-7 h-7 text-[10px] rounded-lg",
  sm: "w-9 h-9 text-xs rounded-xl",
  md: "w-12 h-12 text-sm rounded-xl",
  lg: "w-16 h-16 text-lg rounded-2xl",
  xl: "w-20 h-20 text-xl rounded-2xl",
};

/**
 * Generated team badge used as the visual logo across the dashboard.
 * Uses each team's brand colors so no external image assets are needed.
 */
export function TeamMark({ team, size = "md", className = "" }: TeamMarkProps) {
  const style = {
    background: `linear-gradient(135deg, ${team.primaryColor} 0%, ${team.secondaryColor} 100%)`,
  } as const;

  return (
    <span
      className={`inline-flex items-center justify-center font-extrabold text-white shadow-lg ring-1 ring-white/15 ${sizeClasses[size]} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {team.abbreviation}
    </span>
  );
}

export type { TeamMarkProps, TeamMarkSize };
