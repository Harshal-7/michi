/** The kana game's start-screen choices, kept on this device. Storage can be missing; the game works without it. */
import { DEFAULT_SETTINGS, GROUPS, type GameSettings, LENGTHS, MODES, SCRIPTS } from "@/lib/games/kana/types";

const SETTINGS_KEY = "michi:kana-game";

export function loadSettings(): GameSettings {
  let s: Partial<GameSettings> | null = null;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    s = raw ? (JSON.parse(raw) as Partial<GameSettings>) : null;
  } catch {
    s = null;
  }
  if (!s || typeof s !== "object") return DEFAULT_SETTINGS;
  const scripts = Array.isArray(s.scripts) ? SCRIPTS.filter((x) => s.scripts!.includes(x)) : [];
  const groups = Array.isArray(s.groups) ? GROUPS.filter((x) => s.groups!.includes(x)) : [];
  return {
    mode: MODES.find((m) => m === s.mode) ?? DEFAULT_SETTINGS.mode,
    scripts: scripts.length ? scripts : DEFAULT_SETTINGS.scripts,
    groups: groups.length ? groups : DEFAULT_SETTINGS.groups,
    length: LENGTHS.find((l) => l === s.length) ?? DEFAULT_SETTINGS.length,
    tones: typeof s.tones === "boolean" ? s.tones : DEFAULT_SETTINGS.tones,
  };
}

export function storeSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Nothing is kept, and that's fine.
  }
}
