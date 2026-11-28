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
