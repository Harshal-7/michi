"use client";

import { useEffect, useSyncExternalStore } from "react";

import { PAGE_COLOR, parseThemeChoice, resolveTheme, THEME_KEY, type ResolvedTheme, type ThemeChoice } from "@/lib/theme";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

const readChoice = (): ThemeChoice => parseThemeChoice(read(THEME_KEY));

function apply(choice: ThemeChoice) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = resolveTheme(choice, systemDark);
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PAGE_COLOR[theme]);
}

/** Tells useThemeChoice() in this tab that the choice changed (the storage event only reaches other tabs). */
const CHANGE = "michi:theme-change";

/** Saves this device's system / light / dark choice and applies it at once. For Settings → Theme. */
export function setThemeChoice(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private windows can refuse storage; the theme still changes for this page.
  }
  apply(choice);
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * This device's real theme choice (it lives in the browser, not the database). The server and the
 * first render see `fallback`, usually the value saved in Settings.
 */
export function useThemeChoice(fallback: ThemeChoice = "system"): ThemeChoice {
  return useSyncExternalStore(subscribe, readChoice, () => fallback);
}

function subscribeResolved(onChange: () => void) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  const off = subscribe(onChange);
  dark.addEventListener("change", onChange);
  return () => {
    off();
    dark.removeEventListener("change", onChange);
  };
}

const readResolved = (): ResolvedTheme =>
  resolveTheme(readChoice(), window.matchMedia("(prefers-color-scheme: dark)").matches);

/** Light or dark as this device shows it now (the choice, with "system" resolved). The server sees light. */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribeResolved, readResolved, () => "light");
}

/**
 * Keeps <html data-theme> right after the first paint: follows the device's light or dark setting
 * while the choice is "system", and picks up a change made in another tab.
 */
export function ThemeSync() {
  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => apply(readChoice());
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) apply(readChoice());
    };
    dark.addEventListener("change", onSystem);
    window.addEventListener("storage", onStorage);
    return () => {
      dark.removeEventListener("change", onSystem);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
