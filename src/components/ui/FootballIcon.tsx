interface FootballIconProps {
  className?: string;
  strokeWidth?: number;
}

/**
 * High-quality American Football SVG icon featuring crisp prolate spheroid geometry,
 * pro-style white end stripes, and clean center laces.
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
      {/* Precision American Football prolate shell */}
      <path d="M19.8 4.2C13.8 2.2 6.8 6.2 4.2 12.2C2.2 18.2 6.2 21.8 12.2 19.8C18.2 17.8 21.8 10.2 19.8 4.2Z" />
      {/* Center seam line */}
      <line x1="8.5" y1="15.5" x2="15.5" y2="8.5" />
      {/* Pro ball white stripe accents */}
      <path d="M6.2 9.2C7.2 7.2 8.8 5.8 10.8 5.2" />
      <path d="M13.2 18.8C15.2 18.2 16.8 16.8 17.8 14.8" />
      {/* Laces cross stitches */}
      <line x1="9.8" y1="11.2" x2="11.2" y2="12.6" />
      <line x1="11.3" y1="9.7" x2="12.7" y2="11.1" />
      <line x1="12.8" y1="8.2" x2="14.2" y2="9.6" />
    </svg>
  );
}

export type { FootballIconProps };
