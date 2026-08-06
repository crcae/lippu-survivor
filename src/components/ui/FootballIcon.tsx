interface FootballIconProps {
  className?: string;
  strokeWidth?: number;
}

/**
 * American Football SVG icon component featuring prolate ball shape and laces.
 * Used across navigation, badges, headers, and landing cards.
 */
export function FootballIcon({
  className = "w-5 h-5",
  strokeWidth = 2,
}: FootballIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Tilted American Football ball prolate outline */}
      <path d="M19.5 4.5C13.5 2.5 6.5 6.5 4.5 12.5C2.5 18.5 6.5 21.5 12.5 19.5C18.5 17.5 21.5 10.5 19.5 4.5Z" />
      {/* Center seam line */}
      <line x1="8.5" y1="15.5" x2="15.5" y2="8.5" />
      {/* White Laces stitches */}
      <line x1="9.8" y1="11.2" x2="11.2" y2="12.6" />
      <line x1="11.3" y1="9.7" x2="12.7" y2="11.1" />
      <line x1="12.8" y1="8.2" x2="14.2" y2="9.6" />
    </svg>
  );
}

export type { FootballIconProps };
