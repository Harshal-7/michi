import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DARK_MODE, DEFAULT_LOOKS, type Look, LOOKS, PAGE_COLOR, parseLook, parseThemeChoice, resolveTheme, THEME_SCRIPT } from "./theme";

const css = readFileSync("src/app/globals.css", "utf8");
/** Every block for exactly this selector (:root has one for shared tokens and one for Kumo). */
const block = (selector: string) => {
  let out = "";
  for (let at = css.indexOf(`\n${selector} {`); at >= 0; at = css.indexOf(`\n${selector} {`, at + 1)) {
    out += css.slice(at, css.indexOf("}", at));
  }
  return out;
};
const token = (selector: string, name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(block(selector))?.[1];

/** Each theme's block in globals.css: the defaults sit on :root and [data-theme="dark"]. */
const SELECTOR: Record<Look, string> = {
  kumo: ":root",
  shiro: '[data-look="shiro"]',
  kinu: '[data-look="kinu"]',
  washi: '[data-look="washi"]',
  kuro: '[data-theme="dark"]',
  sumi: '[data-theme="dark"][data-look="sumi"]',
  graphite: '[data-theme="dark"][data-look="graphite"]',
};
const ALL: Look[] = [...LOOKS.light, ...LOOKS.dark];
const COLOR_TOKENS = ["page", "surface", "surface2", "ink", "ink2", "line", "accent", "on-accent", "accent-soft", "good", "warn", "again", "easy", "track", "glow", "shadow", "card-shadow"];

/** WCAG contrast of two #rrggbb colours. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
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
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("dark", true, false)).toBe("light");
  });

  it("reads a stored theme, falling back to the default for its mode", () => {
    expect(DEFAULT_LOOKS).toEqual({ light: "kumo", dark: "kuro" });
    expect(parseLook("light", "kinu")).toBe("kinu");
    expect(parseLook("light", "sumi")).toBe("kumo");
    expect(parseLook("dark", "sumi")).toBe("sumi");
    expect(parseLook("dark", null)).toBe("kuro");
  });

  it("puts the chosen theme on the page before React loads", () => {
    const run = (stored: string | null, systemDark: boolean, looks: Record<string, string> = {}) => {
      const attrs: Record<string, string> = {};
      const meta = { setAttribute: (k: string, v: string) => (attrs[`meta-${k}`] = v) };
      const env = {
        document: {
          documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
          querySelector: () => meta,
          head: { appendChild: () => {} },
        },
        localStorage: { getItem: (key: string) => (key === "michi:theme" ? stored : (looks[key] ?? null)) },
        window: { matchMedia: () => ({ matches: systemDark }) },
        matchMedia: () => ({ matches: systemDark }),
      };
      new Function("document", "localStorage", "window", "matchMedia", THEME_SCRIPT)(
        env.document,
        env.localStorage,
        env.window,
        env.matchMedia,
      );
      return attrs;
    };
    const theme = (stored: string | null, systemDark: boolean) => run(stored, systemDark)["data-theme"];
    expect(theme("dark", false)).toBe("dark");
    expect(theme("light", true)).toBe("light");
    expect(theme(null, true)).toBe("dark");
    expect(theme(null, false)).toBe("light");
    expect(theme("nonsense", true)).toBe("dark");

    const saved = { "michi:light-look": "shiro", "michi:dark-look": "sumi" };
    expect(run("light", false, saved)).toMatchObject({ "data-look": "shiro", "meta-content": "#ffffff" });
    expect(run("dark", false, saved)).toMatchObject({ "data-look": "sumi", "meta-content": PAGE_COLOR.sumi });
    expect(run(null, true)).toMatchObject({ "data-look": "kuro", "meta-content": "#000000" });
    // A light theme saved under the dark key (or nonsense) falls back to the default.
    expect(run("dark", false, { "michi:dark-look": "kinu" })["data-look"]).toBe("kuro");
  });

  it("keeps the address bar and manifest colours in step with the tokens", () => {
    for (const look of ALL) {
      expect(token(SELECTOR[look], "page"), look).toBe(PAGE_COLOR[look]);
      expect(THEME_SCRIPT).toContain(PAGE_COLOR[look]);
    }
  });

  it("fills every colour token in every theme, so no theme borrows from another", () => {
    for (const look of ALL) {
      for (const name of COLOR_TOKENS) expect(token(SELECTOR[look], name), `${look} --${name}`).toBeDefined();
    }
  });

  it("keeps text at 4.5:1 or more on the page, cards and wells in every theme", () => {
    for (const look of ALL) {
      const t = (name: string) => token(SELECTOR[look], name)!;
      for (const fg of ["ink", "ink2", "accent", "good", "warn", "again", "easy"]) {
        for (const bg of ["page", "surface", "surface2"]) {
          expect(contrast(t(fg), t(bg)), `${look}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrast(t("on-accent"), t("accent")), `${look}: on-accent`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t("accent"), t("accent-soft")), `${look}: accent on accent-soft`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("draws the icon in the light accent colours", () => {
    const svg = readFileSync("src/app/icon.svg", "utf8");
    expect(svg).toContain(`<rect width="100" height="100" rx="22" fill="${token(":root", "accent")}"/>`);
    expect(svg).toContain(`<path fill="${token(":root", "on-accent")}"`);
  });
});
