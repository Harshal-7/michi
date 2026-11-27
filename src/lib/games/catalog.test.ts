import { describe, expect, it } from "vitest";

import { CATALOG, hueStyle, isLive, playerHue, SLUGS } from "./catalog";
import { GAMES } from "./registry";

describe("catalog", () => {
  it("lists the 7 public games once each, and every registry game is in it", () => {
    expect(SLUGS).toEqual(["kana", "vocab", "forms", "particles", "numbers", "sounds", "listen"]);
    for (const g of GAMES) expect(SLUGS).toContain(g.slug);
    expect(isLive("kana")).toBe(true);
  });

  it("gives each game one glyph, set apart from its line when it's Japanese", () => {
    expect(new Set(CATALOG.map((g) => g.glyph)).size).toBe(CATALOG.length);
    for (const g of CATALOG) expect(/[ぁ-ゖァ-ヺ一-鿿]/.test(g.note)).toBe(false);
  });

  it("points a game's colour at its tokens, and falls back to the kana game", () => {
    expect(hueStyle("numbers")).toEqual({ "--hue": "var(--g-numbers)", "--hue-tint": "var(--g-numbers-tint)" });
    expect(hueStyle("nope")).toEqual({ "--hue": "var(--g-kana)", "--hue-tint": "var(--g-kana-tint)" });
  });

  it("keeps a player's colour by name, ignoring case", () => {
    expect(playerHue("sakura22")).toBe(playerHue("SAKURA22"));
    expect(SLUGS).toContain(playerHue("みどり"));
    expect(new Set(["kaito", "Harshal", "みどり", "tomo88", "りん", "Aki", "nao"].map(playerHue)).size).toBeGreaterThan(2);
  });
});
