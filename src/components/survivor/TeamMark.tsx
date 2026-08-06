"use client";

import { useState } from "react";
import type { NFLTeam } from "@/types";

/**
 * Official NFL team logo URL helper using ESPN's high-resolution assets.
 */
export const getTeamLogoUrl = (teamId: string) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${teamId.toLowerCase()}.png`;

type TeamMarkSize = "xs" | "sm" | "md" | "lg" | "xl";

interface TeamMarkProps {
  team: NFLTeam;
  size?: TeamMarkSize;
  className?: string;
  useFallbackOnly?: boolean;
}

const sizeClasses: Record<TeamMarkSize, string> = {
  xs: "w-7 h-7 text-[10px] rounded-lg",
  sm: "w-9 h-9 text-xs rounded-xl",
  md: "w-12 h-12 text-sm rounded-xl",
  lg: "w-16 h-16 text-lg rounded-2xl",
  xl: "w-20 h-20 text-xl rounded-2xl",
};

/**
 * Official NFL team logo renderer.
 * Displays high-res official ESPN logos with a gradient badge fallback on error.
 */
export function TeamMark({
  team,
  size = "md",
  className = "",
  useFallbackOnly = false,
}: TeamMarkProps) {
  const [imgError, setImgError] = useState(false);

  const style = {
    background: `linear-gradient(135deg, ${team.primaryColor} 0%, ${team.secondaryColor} 100%)`,
  } as const;

  const logoUrl = getTeamLogoUrl(team.id);

  if (!imgError && !useFallbackOnly) {
    return (
      <span
        className={`relative inline-flex items-center justify-center p-1 overflow-hidden shrink-0 ${sizeClasses[size]} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={`${team.city} ${team.name}`}
          className="w-full h-full object-contain filter drop-shadow-md transition-transform duration-200"
          onError={() => setImgError(true)}
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center font-extrabold text-white shadow-lg ring-1 ring-white/15 shrink-0 ${sizeClasses[size]} ${className}`}
      style={style}
      aria-hidden="true"
    >
      {team.abbreviation}
    </span>
  );
}

export type { TeamMarkProps, TeamMarkSize };
