/**
 * Light or dark, and which light and dark theme, per device. The choices are kept in this browser's
 * localStorage; THEME_SCRIPT runs in <head> before the first paint and puts the resolved mode on
 * <html data-theme> and the theme on <html data-look>, so the page never flashes other colours.
 */

/**
 * Whether the dark themes are offered. It was off for the first round and came back on 22 Nov 2026
 * with the Material-style colours; false again would show light everywhere and hide Settings' Theme row.
 */
export const DARK_MODE = true;

export const THEMES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEMES)[number];
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "michi:theme";

/**
 * The themes Harshal picked on 28 Nov 2026 (canvas page "Themes"), the default first. Each is a block
 * of tokens in src/app/globals.css. They differ in their whites or darks and in how cards sit on the
 * page; the accent and the rating colours are the same in all of them.
 */
export const LOOKS = {
  light: ["kumo", "shiro", "kinu", "washi"],
  dark: ["kuro", "sumi", "graphite"],
} as const satisfies Record<ResolvedTheme, readonly string[]>;
export type LightLook = (typeof LOOKS.light)[number];
export type DarkLook = (typeof LOOKS.dark)[number];
export type Look = LightLook | DarkLook;
export type Looks = { light: LightLook; dark: DarkLook };

export const DEFAULT_LOOKS: Looks = { light: LOOKS.light[0], dark: LOOKS.dark[0] };
export const LOOK_KEY: Record<ResolvedTheme, string> = { light: "michi:light-look", dark: "michi:dark-look" };

/** For Settings: the name and a few words on what sets each theme apart. */
export const LOOK_INFO: Record<Look, { name: string; about: string }> = {
  kumo: { name: "Kumo", about: "light grey page, white cards" },
  shiro: { name: "Shiro", about: "all white, cards drawn with a fine line" },
  kinu: { name: "Kinu", about: "white page, flat grey cards" },
  washi: { name: "Washi", about: "warm cream paper, the first look" },
  kuro: { name: "Kuro", about: "true black, cards drawn with a fine line" },
  sumi: { name: "Sumi", about: "soft charcoal" },
  graphite: { name: "Graphite", about: "grey, the first dark" },
};

/**
 * The page colour of each theme, for the phone's address bar and the manifest. They repeat --page in
 * src/app/globals.css (theme.test.ts checks), because neither can read CSS.
 */
export const PAGE_COLOR: Record<Look, string> = {
  kumo: "#f2f2f1",
  shiro: "#ffffff",
  kinu: "#ffffff",
  washi: "#faf8f3",
  kuro: "#000000",
  sumi: "#1a1918",
  graphite: "#121212",
};

export function parseThemeChoice(value: unknown): ThemeChoice {
  return THEMES.includes(value as ThemeChoice) ? (value as ThemeChoice) : "system";
}

export function parseLook<T extends ResolvedTheme>(theme: T, value: unknown): Looks[T] {
  const allowed: readonly string[] = LOOKS[theme];
  return (allowed.includes(value as string) ? value : DEFAULT_LOOKS[theme]) as Looks[T];
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean, darkMode: boolean = DARK_MODE): ResolvedTheme {
  if (!darkMode) return "light";
  if (choice === "system") return systemDark ? "dark" : "light";
  return choice;
}

const json = (value: unknown) => JSON.stringify(value);

/**
 * Does what parseThemeChoice, resolveTheme and parseLook do, before React loads. It also writes the
 * theme-color meta itself so the address bar matches. Only our own constants go into it.
 */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,c="system",l=null;try{c=localStorage.getItem(${json(
  THEME_KEY,
)})||"system"}catch(e){}if(${json(THEMES)}.indexOf(c)<0)c="system";var t=!${json(DARK_MODE)}?"light":c==="system"?(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):c;try{l=localStorage.getItem(${json(
  LOOK_KEY,
)}[t])}catch(e){}if(${json(LOOKS)}[t].indexOf(l)<0)l=${json(DEFAULT_LOOKS)}[t];d.setAttribute("data-theme",t);d.setAttribute("data-look",l);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m)}m.setAttribute("content",${json(
  PAGE_COLOR,
)}[l])}catch(e){}})()`;
