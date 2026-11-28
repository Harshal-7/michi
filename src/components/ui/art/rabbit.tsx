import type { ReactNode } from "react";

import { P } from "./palette";

/**
 * Yuki-usagi 雪うさぎ, the mascot: a snow-mound rabbit with red berry eyes and leaf ears, no arms or
 * legs (the ears and a little hop do the acting). Each pose has one job:
 * sitting (default, headers) · waving (sign-in, welcome back) · lantern (empty states, end of a
 * session) · reading (Learn, the laptop sidebar) · cheering (session done, /play) · sleepy (rest day,
 * nothing due). The body follows the theme through the --usagi* tokens. Decoration only (aria-hidden).
 */
export type RabbitPose = "sitting" | "waving" | "lantern" | "reading" | "cheering" | "sleepy";

export const RABBIT_POSES: RabbitPose[] = ["sitting", "waving", "lantern", "reading", "cheering", "sleepy"];

const POSES: Record<RabbitPose, ReactNode> = {
  sitting: (
    <><ellipse cx="2" cy="3" rx="74" ry="9" fill="var(--usagi-ground)" /><g transform="rotate(0 8 -60)"><path d="M8 -60 C25.9 -69.85 39.53 -101.64 40 -128 C19.99 -110.84 4.18 -80.07 8 -60Z" fill={P.h3A7F4B} /><path d="M9 -62 L37 -121" stroke={P.h2E6B3E} strokeWidth="2" strokeLinecap="round" opacity=".7" /><path d="M16 -78 L26 -80M22 -92 L31 -95M28 -105 L35 -110" stroke={P.h2E6B3E} strokeWidth="1.6" strokeLinecap="round" opacity=".55" /></g><path d="M-64 2 C-64 -42 -36 -66 0 -66 C38 -66 64 -42 64 2 Z" fill="var(--usagi)" stroke="var(--usagi-edge)" strokeWidth="1.6" /><path d="M30 -58.5 C52 -46 64 -26 64 2 L45 2 C52 -22 48 -42 30 -58.5 Z" fill="var(--usagi-shade)" /><path d="M-64 2 C-36 -7 36 -7 64 2 Z" fill="var(--usagi-shade)" opacity=".55" /><g transform="rotate(0 -14 -62)"><path d="M-14 -62 C-2.83 -80.08 -7.8 -114.9 -22 -138 C-31.08 -112.46 -28.69 -77.36 -14 -62Z" fill={P.h4C9A5C} /><path d="M-14.2 -64 L-21.4 -131" stroke={P.h2E6B3E} strokeWidth="2" strokeLinecap="round" opacity=".7" /><path d="M-16 -82 L-8 -86M-17.5 -97 L-9 -102M-19 -112 L-12 -117M-16 -86 L-24 -90M-17.8 -102 L-26 -106" stroke={P.h2E6B3E} strokeWidth="1.6" strokeLinecap="round" opacity=".55" /></g><ellipse cx="-40" cy="-19" rx="7.5" ry="3.6" fill={P.hF4A7B6} opacity=".8" /><ellipse cx="6" cy="-21" rx="7" ry="3.4" fill={P.hF4A7B6} opacity=".8" /><circle cx="-29" cy="-32" r="7.2" fill={P.hD7263D} /><circle cx="-31.4" cy="-34.4" r="2.3" fill={P.hFFFFFF} /><circle cx="-4" cy="-34" r="7" fill={P.hD7263D} /><circle cx="-6.4" cy="-36.4" r="2.2" fill={P.hFFFFFF} /></>
  ),
  waving: (
    <><ellipse cx="2" cy="3" rx="74" ry="9" fill="var(--usagi-ground)" /><g transform="rotate(30 8 -60)"><path d="M8 -60 C25.9 -69.85 39.53 -101.64 40 -128 C19.99 -110.84 4.18 -80.07 8 -60Z" fill={P.h3A7F4B} /><path d="M9 -62 L37 -121" stroke={P.h2E6B3E} strokeWidth="2" strokeLinecap="round" opacity=".7" /><path d="M16 -78 L26 -80M22 -92 L31 -95M28 -105 L35 -110" stroke={P.h2E6B3E} strokeWidth="1.6" strokeLinecap="round" opacity=".55" /></g><path d="M-64 2 C-64 -42 -36 -66 0 -66 C38 -66 64 -42 64 2 Z" fill="var(--usagi)" stroke="var(--usagi-edge)" strokeWidth="1.6" /><path d="M30 -58.5 C52 -46 64 -26 64 2 L45 2 C52 -22 48 -42 30 -58.5 Z" fill="var(--usagi-shade)" /><path d="M-64 2 C-36 -7 36 -7 64 2 Z" fill="var(--usagi-shade)" opacity=".55" /><g transform="rotate(-4 -14 -62)"><path d="M-14 -62 C-2.83 -80.08 -7.8 -114.9 -22 -138 C-31.08 -112.46 -28.69 -77.36 -14 -62Z" fill={P.h4C9A5C} /><path d="M-14.2 -64 L-21.4 -131" stroke={P.h2E6B3E} strokeWidth="2" strokeLinecap="round" opacity=".7" /><path d="M-16 -82 L-8 -86M-17.5 -97 L-9 -102M-19 -112 L-12 -117M-16 -86 L-24 -90M-17.8 -102 L-26 -106" stroke={P.h2E6B3E} strokeWidth="1.6" strokeLinecap="round" opacity=".55" /></g><ellipse cx="-40" cy="-19" rx="7.5" ry="3.6" fill={P.hF4A7B6} opacity=".8" /><ellipse cx="6" cy="-21" rx="7" ry="3.4" fill={P.hF4A7B6} opacity=".8" /><path d="M-36 -30 q7 -8 14 0M-11 -32 q7 -8 14 0" fill="none" stroke={P.hD7263D} strokeWidth="4.2" strokeLinecap="round" /><path d="M84 -92 q9 -8 7 -20M95 -84 q15 -12 11 -32" fill="none" stroke="var(--tone-blue)" strokeWidth="3.2" strokeLinecap="round" /></>
  ),
  lantern: (
    <><ellipse cx="2" cy="3" rx="74" ry="9" fill="var(--usagi-ground)" /><circle cx="86" cy="-44" r="36" fill={P.hFFC24D} opacity=".18" /><path d="M50 2 L62 -80 Q64 -90 76 -90 L86 -90" fill="none" stroke={P.hA5BB6E} strokeWidth="4" strokeLinecap="round" /><path d="M56 -30h8M59 -58h8" stroke={P.h7E9650} strokeWidth="2" strokeLinecap="round" /><path d="M86 -90 v8" stroke={P.h2A1F2E} strokeWidth="1.8" /><rect x="77" y="-83" width="18" height="7" rx="2.4" fill={P.h2A1F2E} /><rect x="77" y="-14" width="18" height="7" rx="2.4" fill={P.h2A1F2E} /><path d="M77 -76 C63 -70 63 -20 77 -14 L95 -14 C109 -20 109 -70 95 -76Z" fill={P.hFFC24D} /><ellipse cx="86" cy="-45" rx="12" ry="20" fill={P.hFFE08A} opacity=".75" /><path d="M68 -64 Q86 -61 104 -64M66 -52 Q86 -49 106 -52M66 -39 Q86 -36 106 -39M68 -26 Q86 -23 104 -26" fill="none" stroke={P.hE0962E} strokeWidth="1.5" opacity=".6" /><g transform="rotate(0 8 -60)"><path d="M8 -60 C25.9 -69.85 39.53 -101.64 40 -128 C19.99 -110.84 4.18 -80.07 8 -60Z" fill={P.h3A7F4B} /><path d="M9 -62 L37 -121" stroke={P.h2E6B3E} strokeWidth="2" strokeLinecap="round" opacity=".7" /><path d="M16 -78 L26 -80M22 -92 L31 -95M28 -105 L35 -110" stroke={P.h2E6B3E} strokeWidth="1.6" strokeLinecap="round" opacity=".55" /></g><path d="M-64 2 C-64 -42 -36 -66 0 -66 C38 -66 64 -42 64 2 Z" fill="var(--usagi)" stroke="var(--usagi-edge)" strokeWidth="1.6" /><path d="M30 -58.5 C52 -46 64 -26 64 2 L45 2 C52 -22 48 -42 30 -58.5 Z" fill="var(--usagi-shade)" /><path d="M-64 2 C-36 -7 36 -7 64 2 Z" fill="var(--usagi-shade)" opacity=".55" /><g transform="rotate(0 -14 -62)"><path d="M-14 -62 C-2.83 -80.08 -7.8 -114.9 -22 -138 C-31.08 -112.46 -28.69 -77.36 -14 -62Z" fill={P.h4C9A5C} /><path d="M-14.2 -64 L-21.4 -131" stroke={P.h2E6B3E} strokeWidth="2" strokeLinecap="round" opacity=".7" /><path d="M-16 -82 L-8 -86M-17.5 -97 L-9 -102M-19 -112 L-12 -117M-16 -86 L-24 -90M-17.8 -102 L-26 -106" stroke={P.h2E6B3E} strokeWidth="1.6" strokeLinecap="round" opacity=".55" /></g><ellipse cx="-40" cy="-19" rx="7.5" ry="3.6" fill={P.hF4A7B6} opacity=".8" /><ellipse cx="6" cy="-21" rx="7" ry="3.4" fill={P.hF4A7B6} opacity=".8" /><circle cx="-29" cy="-32" r="7.2" fill={P.hD7263D} /><circle cx="-31.4" cy="-34.4" r="2.3" fill={P.hFFFFFF} /><circle cx="-4" cy="-34" r="7" fill={P.hD7263D} /><circle cx="-6.4" cy="-36.4" r="2.2" fill={P.hFFFFFF} /></>
  ),
  reading: (
    <><ellipse cx="2" cy="3" rx="74" ry="9" fill="var(--usagi-ground)" /><g transform="rotate(14 8 -60)"><path d="M8 -60 C25.9 -69.85 39.53 -101.64 40 -128 C19.99 -110.84 4.18 -80.07 8 -60Z" fill={P.h3A7F4B} /><path d="M9 -62 L37 -121" stroke={P.h2E6B3E} strokeWidth="2" strokeLinecap="round" opacity=".7" /><path d="M16 -78 L26 -80M22 -92 L31 -95M28 -105 L35 -110" stroke={P.h2E6B3E} strokeWidth="1.6" strokeLinecap="round" opacity=".55" /></g><path d="M-64 2 C-64 -42 -36 -66 0 -66 C38 -66 64 -42 64 2 Z" fill="var(--usagi)" stroke="var(--usagi-edge)" strokeWidth="1.6" /><path d="M30 -58.5 C52 -46 64 -26 64 2 L45 2 C52 -22 48 -42 30 -58.5 Z" fill="var(--usagi-shade)" /><path d="M-64 2 C-36 -7 36 -7 64 2 Z" fill="var(--usagi-shade)" opacity=".55" /><g transform="rotate(-8 -14 -62)"><path d="M-14 -62 C-2.83 -80.08 -7.8 -114.9 -22 -138 C-31.08 -112.46 -28.69 -77.36 -14 -62Z" fill={P.h4C9A5C} /><path d="M-14.2 -64 L-21.4 -131" stroke={P.h2E6B3E} strokeWidth="2" strokeLinecap="round" opacity=".7" /><path d="M-16 -82 L-8 -86M-17.5 -97 L-9 -102M-19 -112 L-12 -117M-16 -86 L-24 -90M-17.8 -102 L-26 -106" stroke={P.h2E6B3E} strokeWidth="1.6" strokeLinecap="round" opacity=".55" /></g><ellipse cx="-40" cy="-12" rx="7.5" ry="3.6" fill={P.hF4A7B6} opacity=".8" /><ellipse cx="6" cy="-14" rx="7" ry="3.4" fill={P.hF4A7B6} opacity=".8" /><circle cx="-29" cy="-25" r="7.2" fill={P.hD7263D} /><circle cx="-31.4" cy="-26.2" r="2.3" fill={P.hFFFFFF} /><circle cx="-4" cy="-27" r="7" fill={P.hD7263D} /><circle cx="-6.4" cy="-28.2" r="2.2" fill={P.hFFFFFF} /><g transform="translate(6 -2)"><path d="M-58 -12 L-2 -22 L-2 8 L-58 16Z" fill="var(--cover-cobalt)" /><path d="M54 -12 L-2 -22 L-2 8 L54 16Z" fill="var(--cover-cobalt)" /><path d="M-54 -15 L-2 -24 L-2 5 L-54 12Z" fill={P.hFFFFFF} /><path d="M50 -15 L-2 -24 L-2 5 L50 12Z" fill={P.hEEF3FB} /><path d="M-46 -10 L-10 -16.5M-46 -3 L-10 -9.5M-46 4 L-18 -1M42 -10 L6 -16.5M42 -3 L6 -9.5M42 4 L14 -1" stroke={P.hB9C6DC} strokeWidth="1.8" strokeLinecap="round" /></g></>
  ),
  cheering: (
    <><ellipse cx="2" cy="6" rx="54" ry="7" fill="var(--usagi-ground)" /><g transform="translate(0 -14)"><g transform="rotate(22 8 -60)"><path d="M8 -60 C25.9 -69.85 39.53 -101.64 40 -128 C19.99 -110.84 4.18 -80.07 8 -60Z" fill={P.h3A7F4B} /><path d="M9 -62 L37 -121" stroke={P.h2E6B3E} strokeWidth="2" strokeLinecap="round" opacity=".7" /><path d="M16 -78 L26 -80M22 -92 L31 -95M28 -105 L35 -110" stroke={P.h2E6B3E} strokeWidth="1.6" strokeLinecap="round" opacity=".55" /></g><path d="M-64 2 C-64 -42 -36 -66 0 -66 C38 -66 64 -42 64 2 Z" fill="var(--usagi)" stroke="var(--usagi-edge)" strokeWidth="1.6" /><path d="M30 -58.5 C52 -46 64 -26 64 2 L45 2 C52 -22 48 -42 30 -58.5 Z" fill="var(--usagi-shade)" /><path d="M-64 2 C-36 -7 36 -7 64 2 Z" fill="var(--usagi-shade)" opacity=".55" /><g transform="rotate(-18 -14 -62)"><path d="M-14 -62 C-2.83 -80.08 -7.8 -114.9 -22 -138 C-31.08 -112.46 -28.69 -77.36 -14 -62Z" fill={P.h4C9A5C} /><path d="M-14.2 -64 L-21.4 -131" stroke={P.h2E6B3E} strokeWidth="2" strokeLinecap="round" opacity=".7" /><path d="M-16 -82 L-8 -86M-17.5 -97 L-9 -102M-19 -112 L-12 -117M-16 -86 L-24 -90M-17.8 -102 L-26 -106" stroke={P.h2E6B3E} strokeWidth="1.6" strokeLinecap="round" opacity=".55" /></g><ellipse cx="-40" cy="-19" rx="7.5" ry="3.6" fill={P.hF4A7B6} opacity=".8" /><ellipse cx="6" cy="-21" rx="7" ry="3.4" fill={P.hF4A7B6} opacity=".8" /><path d="M-36 -30 q7 -8 14 0M-11 -32 q7 -8 14 0" fill="none" stroke={P.hD7263D} strokeWidth="4.2" strokeLinecap="round" /></g><g stroke="var(--tone-butter)" strokeWidth="3.4" strokeLinecap="round"><path d="M-84 -84 l-11 -8M-72 -104 l-5 -12M88 -84 l11 -8M76 -104 l5 -12" /></g><path d="M-98 -36 l3 -7 3 7 7 3 -7 3 -3 7 -3 -7 -7 -3z" fill="var(--tone-butter)" /><path d="M96 -30 l2.4 -5.6 2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4 -5.6 -5.6 -2.4z" fill="var(--tone-pink)" /></>
  ),
  sleepy: (
    <><ellipse cx="2" cy="3" rx="74" ry="9" fill="var(--usagi-ground)" /><g transform="rotate(58 8 -60)"><path d="M8 -60 C25.9 -69.85 39.53 -101.64 40 -128 C19.99 -110.84 4.18 -80.07 8 -60Z" fill={P.h3A7F4B} /><path d="M9 -62 L37 -121" stroke={P.h2E6B3E} strokeWidth="2" strokeLinecap="round" opacity=".7" /><path d="M16 -78 L26 -80M22 -92 L31 -95M28 -105 L35 -110" stroke={P.h2E6B3E} strokeWidth="1.6" strokeLinecap="round" opacity=".55" /></g><path d="M-64 2 C-64 -42 -36 -66 0 -66 C38 -66 64 -42 64 2 Z" fill="var(--usagi)" stroke="var(--usagi-edge)" strokeWidth="1.6" /><path d="M30 -58.5 C52 -46 64 -26 64 2 L45 2 C52 -22 48 -42 30 -58.5 Z" fill="var(--usagi-shade)" /><path d="M-64 2 C-36 -7 36 -7 64 2 Z" fill="var(--usagi-shade)" opacity=".55" /><g transform="rotate(-52 -14 -62)"><path d="M-14 -62 C-2.83 -80.08 -7.8 -114.9 -22 -138 C-31.08 -112.46 -28.69 -77.36 -14 -62Z" fill={P.h4C9A5C} /><path d="M-14.2 -64 L-21.4 -131" stroke={P.h2E6B3E} strokeWidth="2" strokeLinecap="round" opacity=".7" /><path d="M-16 -82 L-8 -86M-17.5 -97 L-9 -102M-19 -112 L-12 -117M-16 -86 L-24 -90M-17.8 -102 L-26 -106" stroke={P.h2E6B3E} strokeWidth="1.6" strokeLinecap="round" opacity=".55" /></g><ellipse cx="-40" cy="-15" rx="7.5" ry="3.6" fill={P.hF4A7B6} opacity=".8" /><ellipse cx="6" cy="-17" rx="7" ry="3.4" fill={P.hF4A7B6} opacity=".8" /><path d="M-36 -27 q7 6 14 0M-11 -29 q7 6 14 0" fill="none" stroke={P.hD7263D} strokeWidth="4" strokeLinecap="round" /><g fill="none" stroke="var(--tone-peri)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M54 -84 h12 l-12 13 h12" /><path d="M78 -112 h16 l-16 17 h16" /></g></>
  ),
};

/**
 * The rabbit in one pose. It sits on any ground; give it a cover-blue or cover-peri tile when it needs
 * a frame.
 *
 * @example <Rabbit pose="cheering" size={120} />
 */
export function Rabbit({
  pose = "sitting",
  size = 160,
  className,
}: {
  /** What it is doing (see the list above). */
  pose?: RabbitPose;
  /** Width in px; the height follows (240 × 170 frame). */
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={Math.round((size * 170) / 240)}
      viewBox="-120 -150 240 170"
      overflow="visible"
      className={className ? `block shrink-0 ${className}` : "block shrink-0"}
    >
      {POSES[pose]}
    </svg>
  );
}
