import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DARK_MODE, PAGE_COLOR, parseThemeChoice, resolveTheme, THEME_SCRIPT } from "./theme";

const css = readFileSync("src/app/globals.css", "utf8");
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf("}", start));
};
const token = (selector: string, name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(block(selector))?.[1];

describe("theme", () => {
  it("resolves the device's choice", () => {
    expect(resolveTheme("system", true, true)).toBe("dark");
    expect(resolveTheme("system", false, true)).toBe("light");
    expect(resolveTheme("light", true, true)).toBe("light");
    expect(parseThemeChoice("sepia")).toBe("system");
    expect(parseThemeChoice("dark")).toBe("dark");
  });

  it("shows light everywhere while dark mode is off", () => {
    expect(DARK_MODE).toBe(false);
    expect(resolveTheme("dark", true)).toBe("light");
    expect(resolveTheme("system", true)).toBe("light");
  });

  it("puts light on the page before React loads while dark mode is off", () => {
    const run = (stored: string | null, systemDark: boolean) => {
      const attrs: Record<string, string> = {};
      const meta = { setAttribute: () => {} };
      const env = {
        document: {
          documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
          querySelector: () => meta,
          head: { appendChild: () => {} },
        },
        localStorage: { getItem: () => stored },
        window: { matchMedia: () => ({ matches: systemDark }) },
        matchMedia: () => ({ matches: systemDark }),
      };
      new Function("document", "localStorage", "window", "matchMedia", THEME_SCRIPT)(
        env.document,
        env.localStorage,
        env.window,
        env.matchMedia,
      );
      return attrs["data-theme"];
    };
    expect(run("dark", true)).toBe("light");
    expect(run(null, true)).toBe("light");
  });

  it("keeps the address bar and manifest colours in step with the tokens", () => {
    expect(token(":root", "page")).toBe(PAGE_COLOR.light);
    expect(token('[data-theme="dark"]', "page")).toBe(PAGE_COLOR.dark);
    expect(THEME_SCRIPT).toContain(PAGE_COLOR.dark);
  });

  it("draws the icon in the light accent colours", () => {
    const svg = readFileSync("src/app/icon.svg", "utf8");
    expect(svg).toContain(`<rect width="100" height="100" rx="22" fill="${token(":root", "accent")}"/>`);
    expect(svg).toContain(`<path fill="${token(":root", "on-accent")}"`);
  });
});
