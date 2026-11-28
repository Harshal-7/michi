import { type ReactNode, useId } from "react";

import { studyDate } from "@/lib/day";

import {
  BERRY,
  BLUSH,
  CAST,
  EXTRAS,
  FLAKES,
  LEAF_BACK,
  LEAF_FRONT,
  LIT,
  type ScenePalette,
  type Season,
  SEASON_PALETTES,
  seasonFor,
  STARS,
  VEIN,
  WHITE,
} from "./scene-palettes";

export type { Season } from "./scene-palettes";
export { seasonFor } from "./scene-palettes";

type Pick = (p: ScenePalette) => string;
/**
 * A scene colour for both themes at once: light-dark() follows the nearest [data-theme] block's
 * color-scheme, so one SVG serves light, dark and the side-by-side /design panels.
 */
type Col = (pick: Pick) => string;

const f2 = (n: number) => n.toFixed(2);

function Pine({ x, y, s, c }: { x: number; y: number; s: number; c: Col }) {
  const trunk = c((p) => p.trunk);
  const needle = c((p) => p.needle);
  const top = c((p) => p.tree_top);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-16 -31 L0 -33 M1 -47 L15 -48 M1 -62 L-8 -64" stroke={trunk} strokeWidth="3" strokeLinecap="round" />
      <path d="M-4 0 C-6 -16 4 -26 -1 -40 C-4 -50 3 -58 1 -72 L5 -72 C8 -58 1 -50 4 -40 C9 -26 -1 -16 4 0 Z" fill={trunk} />
      <ellipse cx="-17" cy="-31" rx="19" ry="7.5" fill={needle} />
      <path d="M-34.86 -32.12 Q-34.1 -41.5 -17 -42.25 Q0.1 -41.5 0.86 -32.12 Q-17 -28.75 -34.86 -32.12Z" fill={top} />
      <ellipse cx="16" cy="-48" rx="17" ry="7" fill={needle} />
      <path d="M0.02 -49.05 Q0.7 -57.8 16 -58.5 Q31.3 -57.8 31.98 -49.05 Q16 -45.9 0.02 -49.05Z" fill={top} />
      <ellipse cx="-9" cy="-64" rx="15" ry="6.5" fill={needle} />
      <path d="M-23.1 -64.97 Q-22.5 -73.1 -9 -73.75 Q4.5 -73.1 5.1 -64.97 Q-9 -62.05 -23.1 -64.97Z" fill={top} />
      <ellipse cx="5" cy="-79" rx="11" ry="5.5" fill={needle} />
      <path d="M-5.34 -79.82 Q-4.9 -86.7 5 -87.25 Q14.9 -86.7 15.34 -79.82 Q5 -77.35 -5.34 -79.82Z" fill={top} />
    </g>
  );
}

/** A blossom (spring) or maple (autumn) tree; `cols` picks the three crown colours. */
function CrownTree({ x, y, s, c, cols }: { x: number; y: number; s: number; c: Col; cols: (p: ScenePalette) => [string, string, string] }) {
  const trunk = c((p) => p.trunk);
  const [a, b, d] = [0, 1, 2].map((i) => c((p) => cols(p)[i]));
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-5 0 C-6 -14 -2 -26 -8 -40 M-6 -30 C2 -40 10 -46 18 -50 M-7 -36 C-16 -44 -24 -48 -30 -48" fill="none" stroke={trunk} strokeWidth="5" strokeLinecap="round" />
      <path d="M-6 0 C-8 -14 -4 -24 -9 -38 L-3 -38 C1 -24 -1 -14 2 0Z" fill={trunk} />
      <circle cx="-26" cy="-50" r="15" fill={b} />
      <circle cx="16" cy="-54" r="17" fill={b} />
      <circle cx="-8" cy="-62" r="22" fill={a} />
      <circle cx="-30" cy="-58" r="11" fill={a} />
      <circle cx="20" cy="-62" r="12" fill={a} />
      <circle cx="-2" cy="-74" r="12" fill={d} opacity=".9" />
      <circle cx="-20" cy="-66" r="6" fill={d} opacity=".8" />
      <circle cx="12" cy="-66" r="7" fill={d} opacity=".7" />
    </g>
  );
}

/** Lit windows in order: 3 ground panes left to right, the middle pair, then the attic. */
function House({ c, lit, u, season }: { c: Col; lit: number; u: string; season: Season }) {
  const on = [0, 1, 2, 3, 4, 5].map((i) => i < lit);
  const frame = c((p) => p.frame);
  const off = c((p) => p.win_off);
  const glow = `url(#${u}-glow)`;
  const small = (winOn: boolean, x: number, y: number, w: number, h: number, mx: number, gx: number, gy: number, gr: number) => (
    <>
      {winOn && <ellipse cx={gx} cy={gy} rx={gr} ry={gr} fill={glow} />}
      <rect x={x - 1.6} y={y - 1.6} width={w + 3.2} height={h + 3.2} rx="1.6" fill={frame} />
      <rect x={x} y={y} width={w} height={h} fill={winOn ? LIT : off} className="transition-colors duration-300" />
      <rect x={mx} y={y} width="1" height={h} fill={frame} opacity=".55" />
    </>
  );
  const cap = c((p) => p.cap);
  return (
    <g transform="translate(8 0)">
      <path d="M244 41 Q252 31 260 41 L355 148 Q358 152 352 152 L152 152 Q146 152 149 148 Z" fill={cap} />
      <path d="M252 47 L339 152 L165 152 Z" fill={c((p) => p.roof)} />
      <path d="M252 63 L315 152 L189 152 Z" fill={c((p) => p.gable)} />
      <rect x="221" y="105" width="62" height="3" fill={c((p) => p.beam)} />
      <rect x="203" y="130" width="98" height="3" fill={c((p) => p.beam)} />
      {small(on[5], 246, 81, 12, 15, 251.5, 252, 88.5, 19)}
      {small(on[3], 228, 112, 13, 14, 234, 234.5, 119, 19)}
      {small(on[4], 263, 112, 13, 14, 269, 269.5, 119, 19)}
      <rect x="189" y="152" width="126" height="34" fill={c((p) => p.wall)} />
      {[212, 235, 258].map((cx, i) => on[i] && <ellipse key={cx} cx={cx} cy="169" rx="30" ry="22" fill={glow} />)}
      <rect x="199" y="156" width="72" height="26" rx="2" fill={frame} />
      {[201.5, 224.5, 247.5].map((x, i) => (
        <g key={x}>
          <rect x={x} y="158.5" width="21" height="21" fill={on[i] ? LIT : off} className="transition-colors duration-300" />
          <path d={`M${x + 10.5} 158.5v21M${x} 169h21`} stroke={frame} strokeWidth=".9" opacity=".45" />
        </g>
      ))}
      <rect x="281" y="158" width="24" height="28" fill={frame} />
      <path d="M279 155h28v15.5a1.5 1.5 0 0 1-1.5 1.5H294.2V155h-2.4v17H280.5a1.5 1.5 0 0 1-1.5-1.5z" fill={c((p) => p.noren)} />
      <circle cx="286.6" cy="163" r="2.2" fill="none" stroke={WHITE} strokeWidth="1" opacity=".85" />
      <rect x="278" y="154" width="30" height="2.2" rx="1" fill={frame} />
      <rect x="185" y="150" width="134" height="4" rx="1" fill={frame} />
      {season === "winter" && (
        <>
          <circle cx="155" cy="152.4" r="2.8" fill={cap} />
          <circle cx="161" cy="153" r="2.2" fill={cap} />
          <circle cx="349" cy="152.4" r="2.8" fill={cap} />
          <circle cx="343" cy="153" r="2.2" fill={cap} />
          <path d="M171 152l1.5 6.5 1.5-6.5zM177.5 152l1.2 4.5 1.2-4.5zM324 152l1.2 4.5 1.2-4.5zM330 152l1.5 6.5 1.5-6.5z" fill={c((p) => p.icicle ?? p.cap)} />
        </>
      )}
    </g>
  );
}

function Bush({ c, season }: { c: Col; season: Season }) {
  const bush = c((p) => p.bush);
  const top = c((p) => p.bush_top);
  const flower = c((p) => p.flower);
  const mid = c((p) => p.flower_mid);
  const blooms: ReactNode[] = [];
  for (const [cx, cy, r] of [
    [-9, -6, 2.36],
    [4, -9, 2.48],
    [11, -3, 2.11],
  ]) {
    if (season === "winter" || season === "spring") {
      // camellia / azalea: five petals
      for (let k = 0; k < 5; k++) {
        const a = ((-90 + 72 * k) * Math.PI) / 180;
        blooms.push(<circle key={`${cx}-${k}`} cx={f2(cx + r * Math.cos(a))} cy={f2(cy + r * Math.sin(a))} r={r} fill={flower} />);
      }
      blooms.push(<circle key={`${cx}-m`} cx={cx} cy={cy} r={f2(r * 0.68)} fill={mid} />);
    } else if (season === "summer") {
      // hydrangea: tight clusters
      for (const [dx, dy] of [
        [-2.5, -1.5],
        [2.5, -1.5],
        [0, 2],
        [-2.5, 2.5],
        [2.5, 2.5],
        [0, -3.5],
      ]) {
        blooms.push(<circle key={`${cx}-${dx}-${dy}`} cx={cx + dx} cy={cy + dy} r="2.1" fill={(dx + dy) % 2 ? flower : mid} />);
      }
    } else {
      // autumn: persimmons
      blooms.push(<circle key={`${cx}-p`} cx={cx} cy={cy} r={r + 1.2} fill={flower} />);
      blooms.push(<circle key={`${cx}-h`} cx={cx - 0.8} cy={cy - 0.9} r=".8" fill={mid} />);
    }
  }
  return (
    <g transform="translate(180 186)">
      <circle cx="-9" cy="-8" r="8.5" fill={bush} />
      <circle cx="1" cy="-12" r="10" fill={bush} />
      <circle cx="10" cy="-7" r="7.5" fill={bush} />
      {season === "winter" ? (
        <>
          <ellipse cx="-7" cy="-14.6" rx="5.4" ry="2.3" fill={top} />
          <ellipse cx="2.4" cy="-20.6" rx="6.4" ry="2.5" fill={top} />
          <ellipse cx="11" cy="-13" rx="4" ry="1.8" fill={top} />
        </>
      ) : (
        <>
          <circle cx="-4" cy="-15" r="5" fill={top} />
          <circle cx="6" cy="-17" r="4.5" fill={top} />
        </>
      )}
      {blooms}
    </g>
  );
}

function Lantern({ c, on, season, u }: { c: Col; on: boolean; season: Season; u: string }) {
  const stone = c((p) => p.stone);
  const dark = c((p) => p.stone_dark);
  return (
    <g transform="translate(468 192)">
      {on && <circle cx="0" cy="-37" r="46" fill={`url(#${u}-glow)`} />}
      <path d="M-15 0 Q-13 -12 -7 -22 L-3 -22 Q-8 -12 -10 0 Z" fill={stone} />
      <path d="M15 0 Q13 -12 7 -22 L3 -22 Q8 -12 10 0 Z" fill={dark} />
      <rect x="-14" y="-27" width="28" height="5.5" rx="2.5" fill={stone} />
      <rect x="-10" y="-46" width="20" height="19" rx="2" fill={stone} />
      <rect x="-5.5" y="-42" width="11" height="12" rx="1" fill={on ? LIT : c((p) => p.lantern_off)} />
      <path d="M-32 -45 C-22 -53 -10 -57 0 -57 C10 -57 22 -53 32 -45 C16 -48 -16 -48 -32 -45 Z" fill={dark} />
      {season === "winter" ? (
        <>
          <path d="M-29 -49 C-25 -64 -12 -71 0 -71 C12 -71 25 -64 29 -49 C14 -52 -14 -52 -29 -49 Z" fill={c((p) => p.lantern_cap)} />
          <circle cx="0" cy="-74" r="4" fill={stone} />
          <ellipse cx="0" cy="-77.6" rx="4.3" ry="2.2" fill={c((p) => p.lantern_cap)} />
        </>
      ) : (
        <>
          <path d="M-24 -50 C-20 -58 -10 -62 0 -62 C10 -62 20 -58 24 -50 C12 -52 -12 -52 -24 -50 Z" fill={stone} />
          <circle cx="0" cy="-65" r="4.2" fill={dark} />
        </>
      )}
      {on && <ellipse cx="0" cy="2" rx="30" ry="4.5" fill={CAST} opacity="0.55" />}
    </g>
  );
}

function Particles({ c, season }: { c: Col; season: Season }) {
  const col = c((p) => p.particle);
  if (season === "winter") return FLAKES.map(([x, y, r, a]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={col} opacity={a} />);
  if (season === "spring")
    return FLAKES.filter((_, i) => i % 2 === 0).map(([x, y, r, a], i) => (
      <ellipse
        key={`${x}-${y}`}
        cx={x}
        cy={y}
        rx={(r + 1.4).toFixed(1)}
        ry={(r * 0.6 + 0.4).toFixed(1)}
        transform={`rotate(${((i * 37) % 180) - 60} ${x} ${y})`}
        fill={col}
        opacity={Math.min(1, a + 0.1).toFixed(2)}
      />
    ));
  if (season === "summer")
    return (
      [
        [150, 150], [120, 176], [330, 172], [372, 150], [520, 160], [560, 140], [60, 168], [430, 176], [240, 196], [500, 120], [94, 136],
      ] as const
    ).map(([x, y]) => (
      <g key={`${x}-${y}`}>
        <circle cx={x} cy={y} r="7" fill={col} opacity=".18" />
        <circle cx={x} cy={y} r="1.9" fill={col} />
      </g>
    ));
  return (
    [
      [150, 120], [380, 140], [520, 110], [60, 150], [330, 96], [566, 168],
    ] as const
  ).map(([x, y], i) => (
    <path
      key={`${x}-${y}`}
      d={`M${x} ${y - 4} l1.3 2.6 2.7 -.9 -1 2.7 2.4 1.4 -2.6 .8 .3 2.6 -2.1 -1.6 -1 2.4 -1 -2.4 -2.1 1.6 .3 -2.6 -2.6 -.8 2.4 -1.4 -1 -2.7 2.7 .9z`}
      transform={`rotate(${i * 40} ${x} ${y})`}
      fill={c((p) => p.maple![i % 3])}
    />
  ));
}

function Extras({ season }: { season: Season }) {
  if (season === "summer")
    return (
      <g transform="translate(347 152)">
        <path d="M0 0v8" stroke={EXTRAS.chimeString} strokeWidth="1" />
        <path d="M-7.5 16 a7.5 8 0 0 1 15 0z" fill={EXTRAS.chimeGlass} opacity=".95" />
        <path d="M-6.4 12.6 q3.2 -2.4 6.4 0 t6.4 0" fill="none" stroke={EXTRAS.chimeRed} strokeWidth="1.2" />
        <path d="M0 16v6" stroke={EXTRAS.chimeString} strokeWidth=".9" />
        <rect x="-3.5" y="22" width="7" height="14" rx="1" fill={EXTRAS.chimePaper} transform="rotate(8 0 22)" />
      </g>
    );
  if (season === "autumn")
    return (
      <>
        {(
          [
            [300, 206, 34, -6], [308, 206, 40, 4], [520, 196, 34, 8], [528, 198, 28, -4], [40, 204, 30, 6],
          ] as const
        ).map(([gx, gy, h, lean]) => (
          <g key={`${gx}-${gy}`}>
            <path d={`M${gx} ${gy} q${lean} ${-h / 2} ${lean * 2} ${-h}`} fill="none" stroke={EXTRAS.grass} strokeWidth="1.6" strokeLinecap="round" />
            <path d={`M${gx + lean * 2} ${gy - h} q4 6 1 14 q-4 -6 -1 -14z`} fill={EXTRAS.grassTip} />
          </g>
        ))}
        <g transform="translate(338 206)">
          <path d="M-14 -4 h28 l-3 6 h-22z" fill={EXTRAS.stand} />
          <rect x="-11" y="-6" width="22" height="3" rx="1" fill={EXTRAS.standTop} />
          {(
            [
              [-8, -10], [0, -10], [8, -10], [-4, -17.5], [4, -17.5], [0, -25],
            ] as const
          ).map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="4.4" fill={EXTRAS.dango} stroke={EXTRAS.dangoEdge} strokeWidth=".8" />
          ))}
        </g>
      </>
    );
  if (season === "spring")
    return (
      <g stroke={EXTRAS.fence} strokeWidth="2" strokeLinecap="round">
        <path d="M520 204 v-14M532 205 v-14M544 205 v-14M556 204 v-14M514 196 h48" />
      </g>
    );
  return null;
}

function MiniRabbit({ c }: { c: Col }) {
  return (
    <g transform="translate(392 208) scale(1.32)">
      <ellipse cx="1" cy="0.6" rx="21" ry="3.6" fill={c((p) => p.rab_ground)} />
      <path d="M0 -19 C5.87 -22.47 10.1 -33.2 10 -42 C3.5 -36.08 -1.47 -25.65 0 -19Z" fill={LEAF_BACK} />
      <path d="M0.4 -20.5 L8.6 -38.6" stroke={VEIN} strokeWidth=".8" strokeLinecap="round" opacity=".7" />
      <path d="M-19 0 C-19 -13 -11 -21 0 -21 C12 -21 20 -12 20 0 Z" fill={c((p) => p.rab_body)} />
      <path d="M9 -18.6 C16 -14 20 -7.5 20 0 L9.5 0 C13.5 -6 13 -12 9 -18.6 Z" fill={c((p) => p.rab_shade)} />
      <path d="M-6 -19 C-1.17 -24.38 -0.69 -36.38 -4 -45 C-8.59 -36.98 -9.95 -25.06 -6 -19Z" fill={LEAF_FRONT} />
      <path d="M-5.9 -20.5 L-4.3 -41.5" stroke={VEIN} strokeWidth=".8" strokeLinecap="round" opacity=".7" />
      <ellipse cx="-14.2" cy="-5.6" rx="2.9" ry="1.5" fill={BLUSH} opacity=".85" />
      <circle cx="-12" cy="-10.2" r="2.9" fill={BERRY} />
      <circle cx="-12.9" cy="-11.1" r=".95" fill={WHITE} />
    </g>
  );
}

/**
 * The farmhouse at evening, the picture at the top of Today's next-step card. Six windows are the six
 * tasks in the day's plan: one lights per finished task (ground floor left to right, then the middle
 * pair, then the attic), and at 6 of 6 the stone lantern lights too. Four seasons, evening only; the
 * same house and rabbit in each. It follows the theme by itself (light and dark scene palettes through
 * light-dark()). It fills its box (xMidYMax slice): size the wrapper, e.g. `h-36 bg-scene-night`.
 *
 * @example <div className="h-36 overflow-hidden bg-scene-night"><Scene lit={done} /></div>
 */
export function Scene({
  season,
  lit = 0,
  className,
}: {
  /** Which evening. Defaults to today's (Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov autumn). */
  season?: Season;
  /** Lit windows, 0–6 (tasks done); the lantern lights at 6. */
  lit?: number;
  className?: string;
}) {
  const s = season ?? seasonFor(Number(studyDate().slice(5, 7)));
  const n = Math.max(0, Math.min(6, Math.round(lit)));
  const u = `sc${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { light, dark } = SEASON_PALETTES[s];
  const c: Col = (pick) => {
    const a = pick(light);
    const b = pick(dark);
    return a === b ? a : `light-dark(${a}, ${b})`;
  };
  const sky = [0, 1, 2, 3].map((i) => c((p) => p.sky[i]));
  const stars = { winter: 16, spring: 7, summer: 16, autumn: 9 }[s];
  const [mx, my, mr] = s === "autumn" ? [446, 58, 25] : [436, 48, 18];
  const moon = c((p) => p.moon);
  const crater = c((p) => p.crater);
  const ground = c((p) => p.ground);
  const groundShade = c((p) => p.ground_shade);
  const groundLit = Math.min(n, 3);
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 220"
      preserveAspectRatio="xMidYMax slice"
      width="100%"
      height="100%"
      data-season={s}
      data-lit={n}
      className={className ? `block ${className}` : "block"}
    >
      <defs>
        <linearGradient id={`${u}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset=".5" stopColor={sky[1]} />
          <stop offset=".8" stopColor={sky[2]} />
          <stop offset="1" stopColor={sky[3]} />
        </linearGradient>
        <radialGradient id={`${u}-glow`}>
          <stop offset="0" stopColor={LIT} stopOpacity=".62" />
          <stop offset=".45" stopColor={LIT} stopOpacity=".22" />
          <stop offset="1" stopColor={LIT} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${u}-halo`}>
          <stop offset="0" stopColor={LIT} stopOpacity=".22" />
          <stop offset=".6" stopColor={LIT} stopOpacity=".07" />
          <stop offset="1" stopColor={LIT} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${u}-moon`}>
          <stop offset="0" stopColor={WHITE} stopOpacity=".22" />
          <stop offset=".42" stopColor={WHITE} stopOpacity=".08" />
          <stop offset="1" stopColor={WHITE} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${u}-cast`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={CAST} stopOpacity=".5" />
          <stop offset="1" stopColor={CAST} stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="600" height="220" fill={`url(#${u}-sky)`} />
      {STARS.slice(0, stars).map(([x, y, r, a]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={c((p) => p.star)} opacity={a} />
      ))}
      <circle cx={mx} cy={my} r={Math.round(mr * 3.2)} fill={`url(#${u}-moon)`} />
      {s === "summer" ? (
        <path
          d={`M${mx} ${my - mr} A${mr} ${mr} 0 1 0 ${mx} ${my + mr} A${(mr * 0.72).toFixed(1)} ${mr} 0 1 1 ${mx} ${my - mr}Z`}
          fill={moon}
          transform={`rotate(-25 ${mx} ${my})`}
        />
      ) : (
        <>
          <circle cx={mx} cy={my} r={mr} fill={moon} />
          <circle cx={mx - 6} cy={my - 4} r={(mr * 0.18).toFixed(1)} fill={crater} />
          <circle cx={mx + 5} cy={my + 6} r={(mr * 0.12).toFixed(1)} fill={crater} />
          <circle cx={mx + 6} cy={my - 7} r={(mr * 0.08).toFixed(1)} fill={crater} />
        </>
      )}
      <path
        d="M0 128 C40 112 80 104 128 110 C170 115 196 126 236 120 C282 113 318 92 372 94 C420 96 446 116 492 114 C532 112 566 100 600 104 L600 220 L0 220Z"
        fill={c((p) => p.hills)}
      />
      <path
        d="M0 158 C60 147 120 145 170 151 C214 156 250 159 300 155 C360 150 420 141 480 145 C530 148 570 155 600 153 L600 220 L0 220Z"
        fill={c((p) => p.mid)}
      />
      <path d="M380 147 C420 141 452 141 480 145 C510 147 540 152 560 154 C520 152 470 150 380 147Z" fill={c((p) => p.mid_shade)} />
      {n >= 3 && <circle cx="260" cy="128" r="130" fill={`url(#${u}-halo)`} opacity={Math.min(1, n / 6).toFixed(2)} />}
      {s === "spring" || s === "autumn" ? (
        <>
          <CrownTree x={106} y={186} s={1.05} c={c} cols={(p) => (s === "spring" ? p.blossom! : p.maple!)} />
          <Pine x={146} y={188} s={0.72} c={c} />
          <CrownTree x={560} y={184} s={0.85} c={c} cols={(p) => (s === "spring" ? p.blossom! : p.maple!)} />
        </>
      ) : (
        <>
          <Pine x={106} y={186} s={1.05} c={c} />
          <Pine x={146} y={188} s={0.72} c={c} />
          <Pine x={560} y={184} s={0.8} c={c} />
        </>
      )}
      <House c={c} lit={n} u={u} season={s} />
      <Bush c={c} season={s} />
      <path
        d="M0 184 C80 178 150 180 210 185 C270 190 340 186 410 188 C480 190 540 182 600 184 L600 220 L0 220Z"
        fill={ground}
      />
      <path d="M176 187 C208 183 244 186 260 188 C288 186 318 184 338 188 C308 192 218 193 176 187Z" fill={groundShade} />
      {groundLit > 0 && <path d="M207 187 L279 187 L306 214 L180 214Z" fill={`url(#${u}-cast)`} opacity={(groundLit / 3).toFixed(2)} />}
      <ellipse cx="328" cy="196" rx="7" ry="2.2" fill={groundShade} />
      <ellipse cx="350" cy="200" rx="7.5" ry="2.4" fill={groundShade} />
      <Lantern c={c} on={n >= 6} season={s} u={u} />
      <path d="M444 194 Q468 186 492 194Z" fill={ground} />
      <path
        d="M0 208 C70 202 150 204 230 209 C310 214 390 206 470 204 C530 203 570 207 600 206 L600 220 L0 220Z"
        fill={c((p) => p.fore)}
      />
      <Extras season={s} />
      <MiniRabbit c={c} />
      <Particles c={c} season={s} />
    </svg>
  );
}
