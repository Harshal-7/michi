import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DARK_MODE, LEGACY_KEYS, PAGE_COLOR, parseThemeChoice, type ResolvedTheme, resolveTheme, THEME_SCRIPT } from "./theme";

const css = readFileSync("src/app/globals.css", "utf8");
/** The token block for a theme: `:root,\n[data-theme="light"] {` or `[data-theme="dark"] {`. */
const SELECTOR: Record<ResolvedTheme, string> = { light: ':root,\n[data-theme="light"] {', dark: '\n[data-theme="dark"] {' };
const block = (theme: ResolvedTheme) => {
  const at = css.indexOf(SELECTOR[theme]);
  expect(at, `${theme} block`).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf("\n}", at));
};
const token = (theme: ResolvedTheme, name: string) => new RegExp(`\\n\\s*--${name}:\\s*([^;]+);`).exec(block(theme))?.[1];
const THEMES: ResolvedTheme[] = ["light", "dark"];

/** Every colour a theme fills; the dark block must repeat each so nothing leaks from light. */
const COLOR_TOKENS = [
  "page", "surface", "surface2", "raised", "ink", "ink2", "ink3", "line", "line-strong", "track", "accent", "on-accent",
  "accent-soft", "accent-hover", "accent-press", "focus", "good", "warn", "again", "easy", "good-soft", "warn-soft",
  "again-soft", "easy-soft", "hanamaru", "on-cover", "on-cover2", "cover-blue", "cover-mint", "cover-butter", "cover-pink",
  "cover-lilac", "cover-aqua", "cover-peri", "cover-cobalt", "on-cobalt", "tone-cobalt", "tone-blue", "tone-peri",
  "tone-mint", "tone-lilac", "tone-butter", "tone-aqua", "tone-pink", "paper-rule", "ring-metal", "snow", "usagi",
  "usagi-shade", "usagi-edge", "usagi-ground", "lit", "scene-night", "shade", "scrim", "card-shadow", "raised-shadow",
];
const COVERS = ["blue", "mint", "butter", "pink", "lilac", "aqua", "peri"];

/** WCAG contrast of two #rrggbb colours. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("theme", () => {
  it("resolves the device's choice", () => {
    expect(resolveTheme("system", true, true)).toBe("dark");
    expect(resolveTheme("system", false, true)).toBe("light");
    expect(resolveTheme("light", true, true)).toBe("light");
    expect(parseThemeChoice("sepia")).toBe("system");
    expect(parseThemeChoice("dark")).toBe("dark");
  });

  it("follows the choice while dark mode is on, and shows light everywhere when it's off", () => {
    expect(DARK_MODE).toBe(true);
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("dark", true, false)).toBe("light");
  });

  it("puts the chosen theme on the page before React loads, and drops the old look keys once", () => {
    const run = (stored: Record<string, string>, systemDark: boolean) => {
      const attrs: Record<string, string> = {};
      const store = { ...stored };
      const meta = { setAttribute: (k: string, v: string) => (attrs[`meta-${k}`] = v) };
      const env = {
        document: {
          documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
          querySelector: () => meta,
          head: { appendChild: () => {} },
        },
        localStorage: {
          getItem: (key: string) => store[key] ?? null,
          removeItem: (key: string) => delete store[key],
        },
        window: { matchMedia: () => ({ matches: systemDark }) },
        matchMedia: () => ({ matches: systemDark }),
      };
      new Function("document", "localStorage", "window", "matchMedia", THEME_SCRIPT)(env.document, env.localStorage, env.window, env.matchMedia);
      return { attrs, store };
    };
    const theme = (stored: string | null, systemDark: boolean) =>
      run(stored === null ? {} : { "michi:theme": stored }, systemDark).attrs["data-theme"];
    expect(theme("dark", false)).toBe("dark");
    expect(theme("light", true)).toBe("light");
    expect(theme(null, true)).toBe("dark");
    expect(theme(null, false)).toBe("light");
    expect(theme("nonsense", true)).toBe("dark");

    expect(run({ "michi:theme": "dark" }, false).attrs).toMatchObject({ "meta-content": PAGE_COLOR.dark });
    expect(run({}, false).attrs).toMatchObject({ "meta-content": PAGE_COLOR.light });
    // The old looks are ignored and removed; no data-look any more.
    const old = run({ "michi:theme": "light", "michi:light-look": "washi", "michi:dark-look": "sumi" }, false);
    expect(old.attrs["data-look"]).toBeUndefined();
    expect(old.store).toEqual({ "michi:theme": "light" });
    expect(LEGACY_KEYS).toEqual(["michi:light-look", "michi:dark-look"]);
  });

  it("keeps the address bar and manifest colours in step with the tokens", () => {
    for (const t of THEMES) {
      expect(token(t, "page")?.toLowerCase(), t).toBe(PAGE_COLOR[t]);
      expect(THEME_SCRIPT).toContain(PAGE_COLOR[t]);
    }
  });

  it("fills every colour token in both themes, with 6-digit hex where it's a flat colour", () => {
    for (const t of THEMES) {
      for (const name of COLOR_TOKENS) {
        const v = token(t, name);
        expect(v, `${t} --${name}`).toBeDefined();
        if (v!.startsWith("#")) expect(v, `${t} --${name}`).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("keeps text at 4.5:1 or more on every ground", () => {
    for (const t of THEMES) {
      const c = (name: string) => token(t, name)!;
      for (const fg of ["ink", "ink2", "ink3", "accent", "good", "warn", "again", "easy"]) {
        for (const bg of ["page", "surface", "surface2", "raised"]) {
          expect(contrast(c(fg), c(bg)), `${t}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrast(c("on-accent"), c("accent")), `${t}: on-accent on accent`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c("on-accent"), c("accent-hover")), `${t}: on-accent on hover`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c("on-accent"), c("accent-press")), `${t}: on-accent on press`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c("accent"), c("accent-soft")), `${t}: accent on accent-soft`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c("ink"), c("accent-soft")), `${t}: ink on accent-soft`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c("on-cobalt"), c("cover-cobalt")), `${t}: on-cobalt`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(c("hanamaru"), c("page")), `${t}: hanamaru on page`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps the page colour readable on the state colours (inverted chips and banners)", () => {
    for (const t of THEMES) {
      const c = (name: string) => token(t, name)!;
      for (const bg of ["good", "again", "warn", "ink"]) {
        expect(contrast(c("page"), c(bg)), `${t}: page on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps text on covers and soft fills at 4.5:1 (chips, grade buttons, banners)", () => {
    for (const t of THEMES) {
      const c = (name: string) => token(t, name)!;
      const grounds = [...COVERS.map((k) => `cover-${k}`), "good-soft", "warn-soft", "again-soft", "easy-soft"];
      for (const bg of grounds) {
        expect(contrast(c("on-cover"), c(bg)), `${t}: on-cover on ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(c("on-cover2"), c(bg)), `${t}: on-cover2 on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("draws borders and the focus ring at 3:1 against the page", () => {
    for (const t of THEMES) {
      const c = (name: string) => token(t, name)!;
      expect(contrast(c("focus"), c("page")), `${t}: focus`).toBeGreaterThanOrEqual(3);
      // Input and switch borders: the kit's line-strong is the visible edge; ink3 (placeholders) is checked above.
      expect(contrast(c("line-strong"), c("page")), `${t}: line-strong`).toBeGreaterThanOrEqual(1.4);
    }
  });

  it("keeps each game's colour at 4.5:1 on its tint, on cards and on the page, and its tint on it", () => {
    const games = ["kana", "vocab", "forms", "particles", "numbers", "sounds", "listen"];
    for (const t of THEMES) {
      const c = (name: string) => token(t, name)!;
      for (const g of games) {
        const hue = c(`g-${g}`);
        const tint = c(`g-${g}-tint`);
        expect(hue, `${t} --g-${g}`).toMatch(/^#[0-9a-f]{6}$/);
        expect(contrast(hue, tint), `${t}: ${g} on its tint`).toBeGreaterThanOrEqual(4.5);
        for (const bg of ["page", "surface"]) expect(contrast(hue, c(bg)), `${t}: ${g} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        for (const fg of ["ink", "ink2"]) expect(contrast(c(fg), tint), `${t}: ${fg} on ${g} tint`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("draws the icon in the light accent colours", () => {
    const svg = readFileSync("src/app/icon.svg", "utf8");
    expect(svg).toContain(`<rect width="100" height="100" rx="22" fill="${token("light", "accent")}"/>`);
    expect(svg).toContain(`<path fill="${token("light", "on-accent")}"`);
  });
});
