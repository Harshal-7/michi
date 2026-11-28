/** The kana game's checks on the server: which kana a setup may ask and how many. */
import type { GameRules, SetupRule } from "../types";
import { ALL_KANA, kanaFor } from "./content";
import { KANA_SETUPS, parseSetup, deckSizes } from "./setups";

const ALL_KEYS: ReadonlySet<string> = new Set(ALL_KANA.map((k) => k.key));
const STANDARD = new Set(KANA_SETUPS.map((s) => s.key));

export const kanaRules: GameRules = {
  setup(key): SetupRule | null {
    const setup = parseSetup(key);
    if (!setup) return null;
    if (setup.weakest) return { cards: setup.cards, items: ALL_KEYS, standard: false };
    const pool = kanaFor(ALL_KANA, setup.scripts, setup.groups);
    if (pool.length === 0 || !deckSizes(pool.length).includes(setup.cards)) return null;
    return { cards: setup.cards, items: new Set(pool.map((k) => k.key)), standard: STANDARD.has(key) };
  },
};
