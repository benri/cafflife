import type { ReactNode } from "react";
import type { DrinkIcon as DrinkIconKind } from "../domain/drinks";

interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 28, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function DrinkIcon({ kind, ...props }: IconProps & { kind: DrinkIconKind }) {
  switch (kind) {
    case "tea":
      return (
        <Svg {...props}>
          <path d="M4 10h12v3.5A5.5 5.5 0 0 1 10.5 19h-1A5.5 5.5 0 0 1 4 13.5z" />
          <path d="M16 11.5h1.25a2.25 2.25 0 0 1 0 4.5H15.6" />
          <path d="M11 10V6.5c0-1 .8-1.5 1.8-1.5S14.5 5.6 14.5 6.6V7" />
          <rect x="13" y="7" width="3" height="3.2" rx=".6" />
          <path d="M3 21h14" />
        </Svg>
      );
    case "pourover":
      return (
        <Svg {...props}>
          <path d="M4.5 3.5h15L15 10.5H9z" />
          <path d="M8 12h8" />
          <path d="M6.5 14h11v2.5a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4z" />
        </Svg>
      );
    case "aeropress":
      return (
        <Svg {...props}>
          <path d="M8 2.5h8" />
          <path d="M12 2.5v3" />
          <rect x="8.5" y="5.5" width="7" height="10" rx="1" />
          <path d="M7 15.5h10" />
          <path d="M7.5 17.5h9v1.5a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 7.5 19z" />
        </Svg>
      );
    case "instant":
      // A mug with a spoon in it: instant gets stirred, not brewed.
      return (
        <Svg {...props}>
          <path d="M11.5 9.5 15.5 3" />
          <path d="M5.5 9.5h11v3.5a5.5 5.5 0 0 1-5.5 5.5h0A5.5 5.5 0 0 1 5.5 13z" />
          <path d="M16.5 10.5h1.25a2.25 2.25 0 0 1 0 4.5H16" />
          <path d="M4 21h14" />
        </Svg>
      );
    case "espresso":
      return (
        <Svg {...props}>
          <path d="M10 4.5c0 1.2 1 1.4 1 2.6M13 4.5c0 1.2 1 1.4 1 2.6" />
          <path d="M6.5 10h10v2.5a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4z" />
          <path d="M16.5 11h1a2 2 0 0 1 0 4h-1.4" />
          <path d="M4 19.5h16" />
        </Svg>
      );
    case "mug":
      return (
        <Svg {...props}>
          <path d="M5.5 7h10.5v9.5a3.5 3.5 0 0 1-3.5 3.5H9a3.5 3.5 0 0 1-3.5-3.5z" />
          <path d="M16 9h1.5a2.75 2.75 0 0 1 0 5.5H16" />
          <path d="M9 2.5c0 1.2 1 1.4 1 2.6M12.5 2.5c0 1.2 1 1.4 1 2.6" />
        </Svg>
      );
    case "iced":
      return (
        <Svg {...props}>
          <path d="M5.5 8h13" />
          <path d="M6.75 8l1.2 12.1a1 1 0 0 0 1 .9h6.1a1 1 0 0 0 1-.9L17.25 8" />
          <path d="M13 8l1.6-5.5H17" />
          <rect x="9" y="11.5" width="3" height="3" rx=".6" />
          <rect x="12.4" y="14.2" width="2.6" height="2.6" rx=".6" />
        </Svg>
      );
    case "can":
      return (
        <Svg {...props}>
          <rect x="7" y="3.5" width="10" height="17" rx="2" />
          <path d="M7 6.5h10M7 17.5h10" />
          <path d="M10.5 10.5l3 3" />
        </Svg>
      );
    case "bottle":
      return (
        <Svg {...props}>
          <path d="M10 2.5h4" />
          <path d="M10.5 2.5v3L8.5 8.5V19a2 2 0 0 0 2 2h3a2 2 0 0 0 2-2V8.5l-2-3v-3" />
          <path d="M8.5 11.5h7v5h-7" />
        </Svg>
      );
    case "bolt":
      return (
        <Svg {...props}>
          <path d="M13.5 2.5 5.5 13.5h6l-1 8 8-11h-6z" />
        </Svg>
      );
    case "bowl":
      return (
        <Svg {...props}>
          <path d="M3.5 11.5h17a8.5 7 0 0 1-17 0z" />
          <path d="M9 20.5h6" />
          <path d="M10 4.5c0 1.2 1 1.4 1 2.6M14 4.5c0 1.2 1 1.4 1 2.6" />
        </Svg>
      );
    case "doppio":
      return (
        <Svg {...props}>
          <path d="M2.5 10.5h7.5v2.2a3.3 3.3 0 0 1-3.3 3.3H5.8a3.3 3.3 0 0 1-3.3-3.3z" />
          <path d="M12.5 10.5H20v2.2a3.3 3.3 0 0 1-3.3 3.3h-.9a3.3 3.3 0 0 1-3.3-3.3z" />
          <path d="M20 11.3h.6a1.6 1.6 0 0 1 0 3.2h-1" />
          <path d="M5.5 5.5c0 1 .8 1.2.8 2.2M15.5 5.5c0 1 .8 1.2.8 2.2" />
          <path d="M1.5 19h21" />
        </Svg>
      );
  }
}

export function PlusIcon({ size = 24, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function ChevronIcon({ open, size = 16, className }: IconProps & { open: boolean }) {
  return (
    <Svg size={size} className={className}>
      {open ? <path d="M6 15l6-6 6 6" /> : <path d="M6 9l6 6 6-6" />}
    </Svg>
  );
}

export function MoonIcon({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </Svg>
  );
}

export function ChartIcon({ size = 18, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M4 20h16" />
      <path d="M7 16v-5M12 16V7M17 16v-8" />
    </Svg>
  );
}

/** App mark: a cup whose "steam" is the absorb-then-decay curve. */
export function LogoMark({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="15" className="logo-bg" />
      <path
        d="M12 30 C16 30 18 12 22 12 C28 12 34 26 52 29"
        className="logo-curve"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path d="M14 36h30v4a11 11 0 0 1-11 11h-8a11 11 0 0 1-11-11z" className="logo-cup" />
      <path d="M44 38h2.5a5 5 0 0 1 0 10H42" className="logo-handle" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function GearIcon({ size = 22, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.66 0-1.25.4-1.51 1z" />
    </Svg>
  );
}

export function CloseIcon({ size = 22, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function ArrowIcon({ direction, size = 16, className }: IconProps & { direction: "up" | "down" }) {
  return (
    <Svg size={size} className={className}>
      {direction === "up" ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M12 5v14M6 13l6 6 6-6" />}
    </Svg>
  );
}
