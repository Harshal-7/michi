/** Every page in the navigation, with the stroke icons from the canvas (F_Nav, F_More, TodayWeb). */

export const ICONS = {
  today:
    "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M12 2.5v2 M12 19.5v2 M2.5 12h2 M19.5 12h2 M5.3 5.3l1.4 1.4 M17.3 17.3l1.4 1.4 M5.3 18.7l1.4-1.4 M17.3 6.7l1.4-1.4",
  review: "M4 7.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z M8 2.5h10a2 2 0 0 1 2 2v12",
  practice: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M8 12.5l2.8 2.8L16.5 9",
  grammar: "M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z M5 19.5A1.5 1.5 0 0 0 6.5 21H19 M9 7h6 M9 10.5h4",
  log: "M6 3h9l4 4v14H6z M15 3v4h4 M9 12h6 M9 16h4",
  progress: "M4 20V10 M10 20V4 M16 20v-7 M3 20h18",
  work: "M4 8h16v11H4z M9 8V5h6v3 M4 13h16",
  resources:
    "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  decks: "M12 3l9 5-9 5-9-5z M3 12.5l9 5 9-5 M3 17l9 5 9-5",
  settings:
    "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1",
  plus: "M12 5v14 M5 12h14",
  more: "M6 12h.01 M12 12h.01 M18 12h.01",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 5l-7 7 7 7",
  lock: "M6 11h12v9H6z M8 11V8a4 4 0 0 1 8 0v3",
} as const;

export type NavKey =
  | "today"
  | "review"
  | "practice"
  | "grammar"
  | "log"
  | "progress"
  | "work"
  | "resources"
  | "decks"
  | "settings";

export type NavItem = { key: NavKey; href: string; label: string; icon: string; note?: string };

/** The phone's bottom bar. */
export const MAIN_NAV: NavItem[] = [
  { key: "today", href: "/", label: "Today", icon: ICONS.today },
  { key: "review", href: "/review", label: "Review", icon: ICONS.review },
  { key: "practice", href: "/practice", label: "Practice", icon: ICONS.practice },
  { key: "grammar", href: "/grammar", label: "Grammar", icon: ICONS.grammar },
  { key: "log", href: "/log", label: "Log", icon: ICONS.log },
];

/** The More page on a phone; the rest of the sidebar on a laptop. */
export const MORE_NAV: NavItem[] = [
  { key: "progress", href: "/progress", label: "Progress", icon: ICONS.progress, note: "levels, mock scores, minutes" },
  { key: "work", href: "/work", label: "Work Japanese", icon: ICONS.work, note: "interviews, the office and chat" },
  { key: "resources", href: "/resources", label: "Resources", icon: ICONS.resources, note: "links by skill and level" },
  { key: "decks", href: "/decks", label: "Decks", icon: ICONS.decks, note: "switch lists on and off, set the pace" },
  { key: "settings", href: "/settings", label: "Settings", icon: ICONS.settings, note: "dates, classes, voice, reminder" },
];

/** The nav item a path belongs to. */
export function navKeyFor(pathname: string): NavKey | "more" | "add-word" | null {
  if (pathname === "/") return "today";
  if (pathname === "/more" || pathname.startsWith("/more/")) return "more";
  if (pathname === "/add-word") return "add-word";
  const item = [...MAIN_NAV, ...MORE_NAV].find((n) => n.href !== "/" && (pathname === n.href || pathname.startsWith(`${n.href}/`)));
  return item?.key ?? null;
}
