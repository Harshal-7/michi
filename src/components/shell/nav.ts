import type { Cover } from "@/components/ui/chip";
import type { IconName } from "@/components/ui/icon";

/**
 * The app's navigation (RF_Parts nav and sidebar, RF_More): Today · Review · Learn · Practice · More on
 * the phone's bottom bar; the laptop sidebar shows the first four, then More's pages as a quieter group,
 * then "+ Add a word". Games have one door, inside Practice, plus the public /play.
 */

export type MainKey = "today" | "review" | "learn" | "practice" | "more";
export type MoreKey = "progress" | "decks" | "log" | "resources" | "work" | "settings";
export type NavKey = MainKey | MoreKey;

export type NavItem<K extends NavKey = NavKey> = {
  key: K;
  href: string;
  label: string;
  icon: IconName;
};

export type MoreItem = NavItem<MoreKey> & {
  /** The line under the label on the More page. */
  note: string;
  /** The icon tile's cover colour on the More page. */
  cover: Cover;
  /** Not built yet: a dashed tile and a Soon chip, no link. */
  soon?: boolean;
};

/** The phone's bottom bar. */
export const MAIN_NAV: NavItem<MainKey>[] = [
  { key: "today", href: "/", label: "Today", icon: "today" },
  { key: "review", href: "/review", label: "Review", icon: "review" },
  { key: "learn", href: "/learn", label: "Learn", icon: "learn" },
  { key: "practice", href: "/practice", label: "Practice", icon: "practice" },
  { key: "more", href: "/more", label: "More", icon: "more" },
];

/** The More page on a phone; the sidebar's quieter group on a laptop. */
export const MORE_NAV: MoreItem[] = [
  { key: "progress", href: "/progress", label: "Progress", icon: "progress", cover: "blue", note: "a year of reviews, day by day" },
  { key: "decks", href: "/decks", label: "Decks", icon: "decks", cover: "mint", note: "switch lists on and off, set the pace" },
  { key: "log", href: "/log", label: "Log", icon: "log", cover: "butter", note: "add listening and speaking minutes" },
  { key: "resources", href: "/resources", label: "Resources", icon: "resources", cover: "aqua", note: "links by skill and level", soon: true },
  { key: "work", href: "/work", label: "Work Japanese", icon: "work", cover: "peri", note: "interviews, the office and chat" },
  { key: "settings", href: "/settings", label: "Settings", icon: "settings", cover: "lilac", note: "dates, classes, voice, theme" },
];

/** The phone hubs, where "+ Add a word" sits at the top right. */
export const HUBS = ["/", "/review", "/learn", "/practice", "/more"];

/** The nav item a path belongs to (the sidebar's highlight). Grammar lessons live under Learn. */
export function navKeyFor(pathname: string): NavKey | "add-word" | null {
  if (pathname === "/") return "today";
  if (pathname === "/add-word") return "add-word";
  if (pathname === "/grammar" || pathname.startsWith("/grammar/")) return "learn";
  const item = [...MAIN_NAV, ...MORE_NAV].find((n) => n.href !== "/" && (pathname === n.href || pathname.startsWith(`${n.href}/`)));
  return item?.key ?? null;
}

/** The phone bar's highlight: More's pages light up More. */
export function phoneKeyFor(pathname: string): MainKey | null {
  const key = navKeyFor(pathname);
  if (key === null || key === "add-word") return null;
  return MORE_NAV.some((m) => m.key === key) ? "more" : (key as MainKey);
}

/**
 * @deprecated Raw stroke paths for the old screens' `<Icon d={ICONS.x} />`. Use `<Icon name="…" />`;
 * 3b–3d remove the last of these.
 */
export const ICONS = {
  today: "M8.5 3v4 M15.5 3v4 M4 10h16 M9 14.5l2 2 4-4 M7.5 5h9a3.5 3.5 0 0 1 3.5 3.5v8a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5v-8A3.5 3.5 0 0 1 7.5 5z",
  review: "M6 7.5h7.5a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5v-8A2.5 2.5 0 0 1 6 7.5z M8 4.5h9.5a2.5 2.5 0 0 1 2.5 2.5v10",
  practice: "M15.2 4.6l4.2 4.2L9 19.2l-5.2 1 1-5.2L15.2 4.6z M13 6.8l4.2 4.2",
  grammar: "M12 6.8C10 5.3 7.2 4.8 4 5.2v13c3.2-.4 6 .1 8 1.6 2-1.5 4.8-2 8-1.6v-13c-3.2-.4-6 .1-8 1.6z M12 6.8v13",
  log: "M8 3.5h8a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-11a3 3 0 0 1 3-3z M9 8.5h6M9 12h6M9 15.5h3.5",
  progress: "M4 20h16 M7.5 16.5v-5M12 16.5v-9M16.5 16.5V9.5",
  work: "M6.5 7.5h11a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3z M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5 M3.5 12.5h17",
  resources: "M7 4.5h10v15.5l-5-3.6-5 3.6z",
  decks: "M12 4l8 4-8 4-8-4 8-4z M4 12l8 4 8-4 M4 16l8 4 8-4",
  settings: "M4.5 7h9.5M18.5 7h1M4.5 17h3.5M12.5 17h7 M14 7a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0z M8 17a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0z",
  plus: "M12 5.5v13M5.5 12h13",
  more: "M6 12h.01 M12 12h.01 M18 12h.01",
  chevronRight: "M9.5 6l6 6-6 6",
  chevronLeft: "M14.5 6l-6 6 6 6",
  lock: "M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18v-5a2.5 2.5 0 0 1 2.5-2.5z M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5",
  games: "M8 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7z",
} as const;
