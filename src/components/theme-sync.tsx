"use client";

import { useEffect } from "react";

import { PAGE_COLOR, parseThemeChoice, resolveTheme, THEME_KEY, type ThemeChoice } from "@/lib/theme";

function readChoice(): ThemeChoice {
  try {
    return parseThemeChoice(localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

function apply(choice: ThemeChoice) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = resolveTheme(choice, systemDark);
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PAGE_COLOR[theme]);
}

/** Saves this device's theme and applies it at once. For the Settings page (round 1). */
export function setThemeChoice(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private windows can refuse storage; the theme still changes for this page.
  }
  apply(choice);
}

/**
 * Keeps <html data-theme> right after the first paint: follows the device's light or dark
 * setting while the choice is "system", and picks up a change made in another tab.
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
