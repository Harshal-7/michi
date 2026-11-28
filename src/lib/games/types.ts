/** What every game shares: a finished run as the device sends it, and what the server checks it against. */
import { z } from "zod";

/** Longest run the server takes: 6 hours. */
export const MAX_DURATION_MS = 6 * 60 * 60 * 1000;
/** Most cards in a run. */
export const MAX_CARDS = 300;

/**
 * A finished run, as the device sends it to /api/play/runs. The id is made on the device, so a
 * retried save is stored once. `answers` are each card's first answer, in deck order.
 */
export const GameRun = z.object({
  id: z.uuid(),
  game: z.string().min(1).max(40),
  setup: z.string().min(1).max(120),
  playedAt: z.iso.datetime(),
  durationMs: z.int().min(0).max(MAX_DURATION_MS),
  answers: z
    .array(
      z.object({
        item: z.string().min(1).max(120),
        right: z.boolean(),
        ms: z.int().min(0).max(24 * 60 * 60 * 1000),
        given: z.string().max(40),
        tries: z.int().min(1).max(1000),
      }),
    )
    .min(1)
    .max(MAX_CARDS),
});
export type GameRun = z.infer<typeof GameRun>;

/** What a setup key allows: how many cards a full run has, which items it may ask, and whether it ranks. */
export type SetupRule = { cards: number; items: ReadonlySet<string>; standard: boolean };

/** A game's server-side rules. `setup` is null for a key the game doesn't know. */
export type GameRules = { setup: (key: string) => SetupRule | null };
