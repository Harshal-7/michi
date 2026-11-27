"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  DEFAULT_LOOKS,
  LOOK_KEY,
  type Looks,
  PAGE_COLOR,
  parseLook,
  parseThemeChoice,
  type ResolvedTheme,
  resolveTheme,
  THEME_KEY,
  type ThemeChoice,
} from "@/lib/theme";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage; the theme still changes for this page.
  }
}

const readChoice = (): ThemeChoice => parseThemeChoice(read(THEME_KEY));
const readLook = <T extends ResolvedTheme>(theme: T) => parseLook(theme, read(LOOK_KEY[theme]));

function apply(choice: ThemeChoice) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = resolveTheme(choice, systemDark);
  const look = readLook(theme);
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-look", look);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PAGE_COLOR[look]);
}

/** Tells useLooks() in this tab that a theme changed (the storage event only reaches other tabs). */
const CHANGE = "michi:looks";

/** Saves this device's light/dark/system choice and applies it at once. For Settings → Theme. */
export function setThemeChoice(choice: ThemeChoice) {
  write(THEME_KEY, choice);
  apply(choice);
}

/** Saves this device's light or dark theme and applies it at once if it's the one showing. */
export function setLook<T extends ResolvedTheme>(theme: T, look: Looks[T]) {
  write(LOOK_KEY[theme], look);
  apply(readChoice());
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

// useSyncExternalStore compares snapshots by identity, so the pair is cached per value.
let cached: Looks = DEFAULT_LOOKS;
function snapshot(): Looks {
  const light = readLook("light");
  const dark = readLook("dark");
  if (light !== cached.light || dark !== cached.dark) cached = { light, dark };
  return cached;
}

/** This device's light and dark themes. The server (and the first render) sees the defaults. */
export function useLooks(): Looks {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_LOOKS);
}

/**
 * Keeps <html data-theme> and <html data-look> right after the first paint: follows the device's
 * light or dark setting while the choice is "system", and picks up a change made in another tab.
 */
export function ThemeSync() {
  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => apply(readChoice());
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY || e.key === LOOK_KEY.light || e.key === LOOK_KEY.dark) apply(readChoice());
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
