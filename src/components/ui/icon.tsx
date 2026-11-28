/**
 * Michi's one stroke icon set (the kit's icons.svg.txt): 24 viewBox, stroke 2, round caps and joins,
 * colour from currentColor. Sizes: 24 in the nav and icon buttons (2.3 stroke for the current tab),
 * 20 in buttons and the sidebar's quieter group, 16–18 inline. Icons are decoration (aria-hidden);
 * an icon-only button needs its own aria-label (use IconButton).
 */
import type { ReactNode } from "react";

const PATHS = {
  "today": (
    <><rect x="4" y="5" width="16" height="15" rx="3.5" /><path d="M8.5 3v4M15.5 3v4M4 10h16" /><path d="M9 14.5l2 2 4-4" /></>
  ),
  "review": (
    <><rect x="3.5" y="7.5" width="12.5" height="13" rx="2.5" /><path d="M8 4.5h9.5a2.5 2.5 0 0 1 2.5 2.5v10" /></>
  ),
  "learn": (
    <><path d="M12 6.8C10 5.3 7.2 4.8 4 5.2v13c3.2-.4 6 .1 8 1.6 2-1.5 4.8-2 8-1.6v-13c-3.2-.4-6 .1-8 1.6z" /><path d="M12 6.8v13" /></>
  ),
  "practice": (
    <><path d="M15.2 4.6l4.2 4.2L9 19.2l-5.2 1 1-5.2L15.2 4.6z" /><path d="M13 6.8l4.2 4.2" /></>
  ),
  "more": (
    <><rect x="4" y="4" width="6.5" height="6.5" rx="2" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="2" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="2" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="2" /></>
  ),
  "progress": (
    <><path d="M4 20h16" /><path d="M7.5 16.5v-5M12 16.5v-9M16.5 16.5V9.5" /></>
  ),
  "decks": (
    <><path d="M12 4l8 4-8 4-8-4 8-4z" /><path d="M4 12l8 4 8-4" /><path d="M4 16l8 4 8-4" /></>
  ),
  "log": (
    <><rect x="5" y="3.5" width="14" height="17" rx="3" /><path d="M9 8.5h6M9 12h6M9 15.5h3.5" /></>
  ),
  "resources": (
    <><path d="M7 4.5h10v15.5l-5-3.6-5 3.6z" /></>
  ),
  "work": (
    <><rect x="3.5" y="7.5" width="17" height="12" rx="3" /><path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" /><path d="M3.5 12.5h17" /></>
  ),
  "settings": (
    <><path d="M4.5 7h9.5M18.5 7h1M4.5 17h3.5M12.5 17h7" /><circle cx="16.2" cy="7" r="2.2" /><circle cx="10.2" cy="17" r="2.2" /></>
  ),
  "plus": (
    <><path d="M12 5.5v13M5.5 12h13" /></>
  ),
  "close": (
    <><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></>
  ),
  "flag": (
    <><path d="M6 21V4.5" /><path d="M6 4.5h11.5l-2.3 4.2 2.3 4.3H6" /></>
  ),
  "speaker": (
    <><path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>
  ),
  "chevron-right": (
    <><path d="M9.5 6l6 6-6 6" /></>
  ),
  "chevron-left": (
    <><path d="M14.5 6l-6 6 6 6" /></>
  ),
  "chevron-down": (
    <><path d="M6 9.5l6 6 6-6" /></>
  ),
  "arrow-right": (
    <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>
  ),
  "arrow-left": (
    <><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></>
  ),
  "check": (
    <><path d="M5.5 12.5l4 4 9-9" /></>
  ),
  "play": (
    <><path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7z" fill="currentColor" /></>
  ),
  "pause": (
    <><rect x="6.5" y="5" width="4" height="14" rx="1.2" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" /></>
  ),
  "search": (
    <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>
  ),
  "home": (
    <><path d="M4.5 10.6L12 4.5l7.5 6.1V19a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z" /><path d="M9.5 20v-5.5h5V20" /></>
  ),
  "edit": (
    <><path d="M4.5 19.5l1-4.5L15.8 4.7a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L9 18.5z" /><path d="M13.5 7l3.5 3.5" /></>
  ),
  "trash": (
    <><path d="M4.5 7h15M9.5 7V4.5h5V7" /><path d="M6.5 7l1 12.5h9l1-12.5" /><path d="M10.5 11v5M13.5 11v5" /></>
  ),
  "refresh": (
    <><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4.5H15" /></>
  ),
  "undo": (
    <><path d="M9 8.5H4.5V4" /><path d="M4.8 8.5A8 8 0 1 1 6 16.5" /></>
  ),
  "external": (
    <><path d="M13.5 4.5h6v6" /><path d="M19.5 4.5l-8 8" /><path d="M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10" /></>
  ),
  "menu": (
    <><path d="M4.5 7h15M4.5 12h15M4.5 17h15" /></>
  ),
  "mic": (
    <><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" /></>
  ),
  "headphones": (
    <><path d="M4.5 16v-3.5a7.5 7.5 0 0 1 15 0V16" /><rect x="3.5" y="14" width="4.5" height="6" rx="2" /><rect x="16" y="14" width="4.5" height="6" rx="2" /></>
  ),
  "keyboard": (
    <><rect x="3" y="6.5" width="18" height="11" rx="2.5" /><path d="M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M8 14h8" /></>
  ),
  "clock": (
    <><circle cx="12" cy="12" r="8" /><path d="M12 7.5V12l3 2" /></>
  ),
  "calendar": (
    <><rect x="4" y="5" width="16" height="15" rx="3.5" /><path d="M8.5 3v4M15.5 3v4M4 10h16" /></>
  ),
  "target": (
    <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".9" fill="currentColor" /></>
  ),
  "trophy": (
    <><path d="M8 4.5h8v5a4 4 0 0 1-8 0z" /><path d="M8 6.5H5a3 3 0 0 0 3 4M16 6.5h3a3 3 0 0 1-3 4" /><path d="M12 13.5v3M8.5 20h7M9.5 20l.5-3.5h4l.5 3.5" /></>
  ),
  "streak": (
    <><path d="M12 3.5c1 3 4.5 4.6 4.5 9a4.5 4.5 0 0 1-9 0c0-2 1-3.2 2-4 .2 1.6 1 2.4 1.8 2.6C11 8.6 11 6 12 3.5z" /></>
  ),
  "lantern": (
    <><path d="M9.5 3.6h5M9.5 20.4h5M12 2v1.6" /><path d="M8.3 6.4c0-1.6 1.6-2.8 3.7-2.8s3.7 1.2 3.7 2.8v11.2c0 1.6-1.6 2.8-3.7 2.8s-3.7-1.2-3.7-2.8z" /><path d="M8.4 10h7.2M8.4 14h7.2" /></>
  ),
  "eye": (
    <><path d="M2.8 12s3.4-6.5 9.2-6.5 9.2 6.5 9.2 6.5-3.4 6.5-9.2 6.5S2.8 12 2.8 12z" /><circle cx="12" cy="12" r="2.8" /></>
  ),
  "lock": (
    <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>
  ),
  "user": (
    <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c.8-3.7 3.8-6 7.5-6s6.7 2.3 7.5 6" /></>
  ),
  "info": (
    <><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></>
  ),
  "alert": (
    <><path d="M12 4.5l8.5 15h-17z" /><path d="M12 10v4.5M12 17h.01" /></>
  ),
  "offline": (
    <><path d="M3.5 3.5l17 17" /><path d="M8.6 8.9A11 11 0 0 0 3 11.5M12 7a11 11 0 0 1 9 4.5M6.2 14.6a8 8 0 0 1 4-2.2M14.9 12.7a8 8 0 0 1 2.9 1.9M12 18.5h.01" /></>
  ),
  "cloud-up": (
    <><path d="M7.5 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6 3.8 3.8 0 0 1-.9 7.4" /><path d="M12 19.5v-7M9 15l3-3 3 3" /></>
  ),
  "sun": (
    <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></>
  ),
  "moon": (
    <><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" /></>
  ),
  "monitor": (
    <><rect x="3.5" y="4.5" width="17" height="12" rx="2.5" /><path d="M9 20h6M12 16.5V20" /></>
  ),
  "logout": (
    <><path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3" /><path d="M10 16.5L5.5 12 10 7.5M5.5 12h10" /></>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

/** Every icon name, for /design. */
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

/**
 * One icon from the set.
 *
 * @example <Icon name="today" />  <Icon name="chevron-right" size={18} className="text-ink3" />
 */
export function Icon({
  name,
  d,
  size = 24,
  stroke = 2,
  className,
}: {
  /** Which icon from the set. */
  name?: IconName;
  /** @deprecated A raw path from the old screens. Use `name`; 3b–3d remove the last of these. */
  d?: string;
  /** Width and height in px (24 nav and icon buttons, 20 in buttons, 16–18 inline). */
  size?: number;
  /** Stroke width; 2.3 for the current nav tab. */
  stroke?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `shrink-0 ${className}` : "shrink-0"}
    >
      {name ? PATHS[name] : <path d={d} />}
    </svg>
  );
}
