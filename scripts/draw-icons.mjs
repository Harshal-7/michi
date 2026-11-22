// Draws the app's PNG icons from src/app/icon.svg. Run it after changing the icon:
//   pnpm icons        (needs Google Chrome; CHROME=<path> to use another)
//
//   public/icons/icon-192.png, icon-512.png   the icon as it is, rounded corners and all
//   public/icons/icon-maskable-512.png        square, 道 shrunk into the circle Android may crop to
//   src/app/apple-icon.png                    square at 180px: iPhones round the corners themselves
//
// The icon is 道 from Zen Old Mincho Bold (SIL Open Font License) as a path, so it looks the
// same everywhere without the font, on --accent with --on-accent (light theme).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const svg = readFileSync("src/app/icon.svg", "utf8").trim();
// The icon is a rounded accent square with the glyph drawn on it.
const [, open, square, glyph] = svg.match(/^(<svg[^>]*>)(<rect [^>]*\/>)(.*)<\/svg>$/s) ?? [];
if (!glyph) throw new Error("src/app/icon.svg should be <svg><rect …/>…</svg>");
const sharp = square.replace(/\s+rx="[^"]*"/, "");
// Android's safe zone is the middle circle, 80% of the width across.
const shrunk = `<g transform="translate(50 50) scale(0.8) translate(-50 -50)">${glyph}</g>`;

const icons = [
  { file: "public/icons/icon-192.png", size: 192, art: svg },
  { file: "public/icons/icon-512.png", size: 512, art: svg },
  { file: "public/icons/icon-maskable-512.png", size: 512, art: `${open}${sharp}${shrunk}</svg>` },
  { file: "src/app/apple-icon.png", size: 180, art: `${open}${sharp}${glyph}</svg>` },
];

mkdirSync("public/icons", { recursive: true });
const work = mkdtempSync(join(tmpdir(), "draw-icons-"));
try {
  for (const { file, size, art } of icons) {
    const page = join(work, "icon.html");
    const sized = art.replace("<svg ", `<svg width="${size}" height="${size}" `);
    writeFileSync(page, `<!doctype html><body style="margin:0">${sized}</body>`);
    rmSync(file, { force: true });
    execFileSync(
      CHROME,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        `--user-data-dir=${join(work, "profile")}`,
        "--default-background-color=00000000",
        `--window-size=${size},${size}`,
        `--screenshot=${join(process.cwd(), file)}`,
        `file://${page}`,
      ],
      { stdio: "ignore" },
    );
    if (!existsSync(file)) throw new Error(`Chrome didn't draw ${file}`);
    console.log(`${file}  ${size}×${size}`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
