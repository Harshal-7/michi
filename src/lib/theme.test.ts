import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PAGE_COLOR, parseThemeChoice, resolveTheme, THEME_SCRIPT } from "./theme";

const css = readFileSync("src/app/globals.css", "utf8");
const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf("}", start));
};
const token = (selector: string, name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(block(selector))?.[1];

describe("theme", () => {
  it("resolves the device's choice", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(parseThemeChoice("sepia")).toBe("system");
    expect(parseThemeChoice("dark")).toBe("dark");
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
