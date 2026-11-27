/**
 * What the game keeps on this device: the last settings, and finished games still waiting to
 * save (no signal, or the save failed). Storage can be missing or full; the game works without it.
 */
import { DEFAULT_SETTINGS, GROUPS, type GameSettings, LENGTHS, MODES, SCRIPTS } from "@/lib/kana-game/types";
import type { SavedGame } from "@/lib/kana-game/data";

const SETTINGS_KEY = "michi:kana-game";
const PENDING_KEY = "michi:kana-game:pending";

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private window or full storage: nothing is kept, and that's fine.
  }
}

export function loadSettings(): GameSettings {
  const s = read(SETTINGS_KEY) as Partial<GameSettings> | null;
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

export const storeSettings = (settings: GameSettings) => write(SETTINGS_KEY, settings);

export function pendingGames(): SavedGame[] {
  const list = read(PENDING_KEY);
  return Array.isArray(list) ? (list as SavedGame[]) : [];
}

export const setPendingGames = (games: SavedGame[]) => write(PENDING_KEY, games.length ? games.slice(-20) : null);
