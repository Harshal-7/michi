/**
 * The farmhouse scene's colours, one palette per season, light and dark (C's "Kisetsu" scene, ported
 * from the kit generator tools/final_art.py). Scene colours belong to the scene, not to the UI tokens;
 * the UI never changes with the season. Dark palettes pull the landscape toward a deep night ink.
 */

export type Season = "winter" | "spring" | "summer" | "autumn";

export type ScenePalette = {
  sky: [string, string, string, string];
  star: string;
  moon: string;
  crater: string;
  hills: string;
  mid: string;
  mid_shade: string;
  trunk: string;
  needle: string;
  tree_top: string;
  cap: string;
  roof: string;
  gable: string;
  beam: string;
  frame: string;
  wall: string;
  win_off: string;
  bush: string;
  bush_top: string;
  flower: string;
  flower_mid: string;
  ground: string;
  ground_shade: string;
  stone: string;
  stone_dark: string;
  lantern_cap: string;
  lantern_off: string;
  fore: string;
  rab_body: string;
  rab_shade: string;
  rab_ground: string;
  particle: string;
  icicle?: string;
  noren: string;
  blossom?: [string, string, string];
  maple?: [string, string, string];
};

/** Window and lantern light. */
export const LIT = "#FFD45E";
export const CAST = "#FFE39A";
export const WHITE = "#FFFFFF";
export const LEAF_FRONT = "#4C9A5C";
export const LEAF_BACK = "#3A7F4B";
export const VEIN = "#2E6B3E";
export const BERRY = "#D7263D";
export const BLUSH = "#F4A7B6";
/** The summer wind chime and the autumn dango and grass. */
export const EXTRAS = {
  chimeString: "#211A22",
  chimeGlass: "#D6F1FF",
  chimeRed: "#D3263C",
  chimePaper: "#FCEBAF",
  dango: "#FFF6E6",
  dangoEdge: "#E6D3B3",
  stand: "#C79A5B",
  standTop: "#E2B878",
  grass: "#8A6A3E",
  grassTip: "#F1DDAA",
  fence: "#9C7A55",
};

const WINTER_L: ScenePalette = {
  sky: ["#1B2455", "#2A3676", "#475394", "#7C7BB6"], star: "#FFFFFF", moon: "#FFF1C4", crater: "#F1DFA4",
  hills: "#3A468A", mid: "#98A2D5", mid_shade: "#8792C8", trunk: "#3B2B33", needle: "#1E4950", tree_top: "#EEF2FB",
  cap: "#F5F8FE", roof: "#7A5A4D", gable: "#56414F", beam: "#6F5666", frame: "#2A1F2E", wall: "#46343F", win_off: "#363F77",
  bush: "#1F5546", bush_top: "#EEF2FB", flower: "#E0365C", flower_mid: "#FFD45E", ground: "#E7ECF8", ground_shade: "#CBD4ED",
  stone: "#8C94BD", stone_dark: "#6F78A4", lantern_cap: "#F5F8FE", lantern_off: "#2E3667", fore: "#F5F7FD",
  rab_body: "#FFFFFF", rab_shade: "#DAE1F3", rab_ground: "#DCE3F4", particle: "#FFFFFF", icicle: "#DDE6F8", noren: "#2453C4",
};
const WINTER_D: ScenePalette = {
  ...WINTER_L,
  sky: ["#0A0E25", "#111838", "#1A224A", "#262F5C"], moon: "#FFF0BE", crater: "#EAD79A", hills: "#151C40", mid: "#4A5588",
  mid_shade: "#404B7D", trunk: "#2A1E25", needle: "#12323A", tree_top: "#B6C0DC", cap: "#C3CCE5", roof: "#5A4239", gable: "#3B2D37",
  beam: "#4E3C49", frame: "#1A131D", wall: "#30242C", win_off: "#222953", bush: "#173F35", bush_top: "#B6C0DC", flower: "#D8345A",
  ground: "#9AA6CC", ground_shade: "#8592BC", stone: "#5C6491", stone_dark: "#495179", lantern_cap: "#C3CCE5", lantern_off: "#1E244E",
  fore: "#B0BBDC", rab_body: "#E3E8F6", rab_shade: "#B9C2DE", rab_ground: "#98A4CB", particle: "#E6EBF8", icicle: "#A9B4D4", noren: "#2F5BCB",
};
const SPRING_L: ScenePalette = {
  sky: ["#2E2F6B", "#5E4A8C", "#B5799F", "#F1B3AE"], star: "#FFFFFF", moon: "#FFF3DC", crater: "#F3DFC0",
  hills: "#6A5B92", mid: "#86A783", mid_shade: "#779A77", trunk: "#4A3540", needle: "#2F5A47", tree_top: "#3F7258",
  cap: "#B88E5F", roof: "#7A5A4D", gable: "#56414F", beam: "#6F5666", frame: "#2A1F2E", wall: "#46343F", win_off: "#3D3A6E",
  bush: "#2F5A3F", bush_top: "#3E7250", flower: "#F27FA6", flower_mid: "#FFE3EC", ground: "#A9C99B", ground_shade: "#95B889",
  stone: "#9C97B3", stone_dark: "#7F7997", lantern_cap: "#9C97B3", lantern_off: "#3D3A6E", fore: "#C5DFB4",
  rab_body: "#FFFFFF", rab_shade: "#DAE1F3", rab_ground: "#8FB282", particle: "#FFC4D4", noren: "#2453C4",
  blossom: ["#F7BCCB", "#EE9DB5", "#FFE0E8"],
};
const SUMMER_L: ScenePalette = {
  sky: ["#06202D", "#0B3443", "#125363", "#1D7275"], star: "#FFFFFF", moon: "#FFF4CF", crater: "#F1E3AE",
  hills: "#0E3B45", mid: "#215E51", mid_shade: "#1C5347", trunk: "#2D2A26", needle: "#173F33", tree_top: "#2C6A4E",
  cap: "#AE8A5C", roof: "#6E5244", gable: "#4A3A40", beam: "#5E4A55", frame: "#211A22", wall: "#3C2E34", win_off: "#173E4C",
  bush: "#1F4F3C", bush_top: "#2B6449", flower: "#86ABEB", flower_mid: "#B7A0EA", ground: "#2E6E59", ground_shade: "#28624F",
  stone: "#628283", stone_dark: "#4D6C6D", lantern_cap: "#628283", lantern_off: "#173E4C", fore: "#3B8068",
  rab_body: "#F4F7FC", rab_shade: "#C9D6DE", rab_ground: "#255F4D", particle: "#EAF78E", noren: "#2453C4",
};
const AUTUMN_L: ScenePalette = {
  sky: ["#2A2350", "#64395F", "#C45F4A", "#F09A56"], star: "#FFFFFF", moon: "#FFE6AE", crater: "#F2CF86",
  hills: "#583350", mid: "#94603F", mid_shade: "#84543A", trunk: "#3B2B33", needle: "#2F4A3A", tree_top: "#3E5E45",
  cap: "#B88E5F", roof: "#7A5A4D", gable: "#56414F", beam: "#6F5666", frame: "#2A1F2E", wall: "#46343F", win_off: "#3E2F52",
  bush: "#7E2E26", bush_top: "#9C3A2C", flower: "#F08A3A", flower_mid: "#FFC46B", ground: "#BE8F58", ground_shade: "#AB7E4C",
  stone: "#8F8292", stone_dark: "#726676", lantern_cap: "#8F8292", lantern_off: "#3E2F52", fore: "#D2AA70",
  rab_body: "#FFFFFF", rab_shade: "#E4DCE6", rab_ground: "#AD8250", particle: "#E8743A", noren: "#2453C4",
  maple: ["#D8452B", "#E8743A", "#F2A541"],
};

const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
/** Mixes colour a toward b by t (0..1), like the generator's mix(). */
export function mix(a: string, b: string, t: number): string {
  const A = hex(a);
  const B = hex(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

const KEEP = new Set(["star", "moon", "crater", "flower_mid", "particle", "noren", "rab_body", "rab_shade"]);

/** The dark-theme version of a palette: the landscape pulled toward a deep night ink. */
function night(p: ScenePalette, t = 0.3, to = "#0B0D1A"): ScenePalette {
  const q: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) {
    if (Array.isArray(v)) q[k] = v.map((c: string) => mix(c, to, t));
    else if (KEEP.has(k) || typeof v !== "string" || !v.startsWith("#")) q[k] = v;
    else q[k] = mix(v, to, t);
  }
  q.rab_body = mix(p.rab_body, "#9AA6CC", 0.12);
  q.rab_shade = mix(p.rab_shade, to, 0.15);
  return q as ScenePalette;
}

export const SEASON_PALETTES: Record<Season, { light: ScenePalette; dark: ScenePalette }> = {
  winter: { light: WINTER_L, dark: WINTER_D },
  spring: { light: SPRING_L, dark: night(SPRING_L) },
  summer: { light: SUMMER_L, dark: night(SUMMER_L, 0.25) },
  autumn: { light: AUTUMN_L, dark: night(AUTUMN_L) },
};

export const STARS: [number, number, number, number][] = [
  [60, 24, 1.5, 0.85], [118, 52, 1, 0.55], [172, 18, 1, 0.85], [214, 44, 1.5, 0.55], [318, 22, 1, 0.85], [362, 60, 1, 0.55],
  [392, 14, 1.5, 0.85], [544, 26, 1, 0.55], [572, 70, 1, 0.85], [24, 64, 1.5, 0.55], [300, 58, 1, 0.85], [520, 104, 1, 0.55],
  [148, 84, 1.5, 0.85], [86, 96, 1, 0.55], [446, 112, 1, 0.85], [580, 120, 1.5, 0.55],
];

export const FLAKES: [number, number, number, number][] = [
  [432.1, 13.6, 1.7, 0.58], [457.8, 100.3, 1.7, 0.61], [158, 114.3, 1.2, 0.58], [428.3, 99.4, 2.2, 0.9], [194.2, 141.4, 1.4, 0.82],
  [315.9, 169, 1.8, 0.55], [526.4, 66.8, 2.5, 0.86], [252.4, 146.1, 1.2, 0.7], [517.9, 124.2, 2.1, 0.86], [350.6, 120, 1, 0.7],
  [298.1, 117.9, 2.2, 0.89], [398.8, 79, 2.1, 0.83], [279.8, 197.9, 2.4, 0.84], [406.3, 192.7, 2.2, 0.57], [39.7, 111.4, 2.4, 0.69],
  [324.1, 62.8, 1.7, 0.77], [346.7, 82.7, 2.2, 0.62], [571.6, 132, 2.2, 0.86], [36.7, 86.9, 1.2, 0.83], [464.4, 127.8, 2.6, 0.95],
  [588.2, 120.2, 2.4, 0.93], [488.1, 68, 2, 0.93], [234.6, 123.4, 1.1, 0.8], [328.4, 56.3, 2.4, 0.57], [508.9, 23.3, 1.6, 0.91],
  [17.4, 137.4, 1.1, 0.67], [70, 150, 2, 0.8], [560, 160, 1.8, 0.7],
];

/** The season for a date, evening scenes only: Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov autumn. */
export function seasonFor(month: number): Season {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}
