/**
 * Light or dark, per device. The choice ("system", "light" or "dark") is kept in this browser's
 * localStorage; THEME_SCRIPT runs in <head> before the first paint and puts the resolved theme
 * on <html data-theme>, so the page never flashes the other colours.
 */

export const THEMES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEMES)[number];
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "michi:theme";

/**
 * The page colour of each theme, for the phone's address bar and the manifest. They repeat
 * --page in src/app/globals.css (brand.test.ts checks), because neither can read CSS.
 */
export const PAGE_COLOR: Record<ResolvedTheme, string> = { light: "#f3eee4", dark: "#15120e" };
/** --accent in light, the icon's background. */
export const ACCENT_COLOR = "#b03a22";

export function parseThemeChoice(value: unknown): ThemeChoice {
  return THEMES.includes(value as ThemeChoice) ? (value as ThemeChoice) : "system";
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): ResolvedTheme {
  if (choice === "system") return systemDark ? "dark" : "light";
  return choice;
}

const json = (value: unknown) => JSON.stringify(value);

/**
 * Does what parseThemeChoice and resolveTheme do, before React loads. It also writes the
 * theme-color meta itself so the address bar matches. Only our own constants go into it.
 */
export const THEME_SCRIPT = `(function(){try{var d=document.documentElement,c="system";try{c=localStorage.getItem(${json(
  THEME_KEY,
)})||"system"}catch(e){}if(${json(THEMES)}.indexOf(c)<0)c="system";var t=c==="system"?(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):c;d.setAttribute("data-theme",t);var m=document.querySelector('meta[name="theme-color"]');if(!m){m=document.createElement("meta");m.setAttribute("name","theme-color");document.head.appendChild(m)}m.setAttribute("content",${json(
  PAGE_COLOR,
)}[t])}catch(e){}})()`;
