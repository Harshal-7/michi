/**
 * Light or dark, per device. The choice (system, light or dark) is kept in this browser's localStorage;
 * THEME_SCRIPT runs in <head> before the first paint and puts the resolved theme on <html data-theme>,
 * so the page never flashes the other colours. One light and one dark theme (the 2026 redesign).
 */

/**
 * Whether dark is offered. False would show light everywhere and hide Settings' Theme row.
 */
export const DARK_MODE = true;

export const THEMES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEMES)[number];
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "michi:theme";

/**
 * The old per-device look choices (the seven looks before the redesign). The script deletes them once,
 * and nothing reads them.
 */
export const LEGACY_KEYS = ["michi:light-look", "michi:dark-look"] as const;

/**
 * The page colour of each theme, for the phone's address bar and the manifest. They repeat --page in
 * src/app/globals.css (theme.test.ts checks), because neither can read CSS.
 */
export const PAGE_COLOR: Record<ResolvedTheme, string> = {
  light: "#ffffff",
  dark: "#12151c",
};

export function parseThemeChoice(value: unknown): ThemeChoice {
  return THEMES.includes(value as ThemeChoice) ? (value as ThemeChoice) : "system";
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean, darkMode: boolean = DARK_MODE): ResolvedTheme {
  if (!darkMode) return "light";
  if (choice === "system") return systemDark ? "dark" : "light";
  return choice;
}

const json = (value: unknown) => JSON.stringify(value);

/**
 * Does what parseThemeChoice and resolveTheme do, before React loads: sets data-theme and writes the
 * theme-color meta so the address bar matches, and removes the old look keys. Only our own constants
 * go into it.
 */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,c="system";try{c=localStorage.getItem(${json(
  THEME_KEY,
)})||"system";${json(LEGACY_KEYS)}.forEach(function(k){if(localStorage.getItem(k)!==null)localStorage.removeItem(k)})}catch(e){}if(${json(
  THEMES,
)}.indexOf(c)<0)c="system";var t=!${json(DARK_MODE)}?"light":c==="system"?(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):c;d.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m)}m.setAttribute("content",${json(
  PAGE_COLOR,
)}[t])}catch(e){}})()`;
