import { type ReactNode, useId } from "react";

import type { Cover } from "@/components/ui/chip";

const SHEET: Record<Cover, string> = {
  blue: "bg-cover-blue",
  mint: "bg-cover-mint",
  butter: "bg-cover-butter",
  pink: "bg-cover-pink",
  lilac: "bg-cover-lilac",
  aqua: "bg-cover-aqua",
  peri: "bg-cover-peri",
};

/** The metal ring through the card's top-left corner (RF_ReviewFront). */
function Ring() {
  const clip = `ring${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg aria-hidden="true" width="80" height="90" viewBox="0 0 80 90" overflow="visible" className="pointer-events-none absolute -top-10 -left-3.5">
      <defs>
        <clipPath id={clip}>
          <rect x="-20" y="-20" width="140" height="60" />
          <rect x="44" y="30" width="40" height="40" />
          <circle cx="44" cy="70" r="8" />
        </clipPath>
      </defs>
      <circle cx="44" cy="70" r="8.5" fill="var(--surface2)" stroke="var(--line-strong)" strokeWidth="1.5" />
      <g clipPath={`url(#${clip})`} fill="none">
        <ellipse cx="44" cy="45" rx="10" ry="25" stroke="var(--ring-metal)" strokeWidth="5" />
        <ellipse cx="44" cy="45" rx="10" ry="25" stroke="var(--snow)" strokeOpacity="0.55" strokeWidth="1.4" transform="translate(1.4 0)" />
      </g>
    </svg>
  );
}

/**
 * B's ring-bound notebook card (RF_ReviewFront, RF_ReviewBack, RF_QuickCheck): two cover-coloured
 * sheets peeking out behind, the ring through the corner, ruled lines filling whatever room is left
 * at the bottom. It grows to its box; the content scrolls inside it when a phone is short.
 *
 * @example <NotebookCard label="Card 7 of 18, front" sheets={["mint", "pink"]}>…</NotebookCard>
 */
export function NotebookCard({
  label,
  sheets = ["mint", "pink"],
  rules = 4,
  className,
  children,
}: {
  /** The article's name ("Card 7 of 18, answer"). */
  label: string;
  /** The two sheets behind: the back one (tilted right), then the front one (tilted left). */
  sheets?: [Cover, Cover];
  /** Ruled lines at the bottom, shown as room allows. */
  rules?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative flex min-h-0 flex-col ${className ?? ""}`}>
      <div aria-hidden="true" className={`absolute inset-x-2.5 top-3.5 -bottom-3.5 rotate-2 rounded-card ${SHEET[sheets[0]]}`} />
      <div aria-hidden="true" className={`absolute inset-x-1.5 top-2 -bottom-2 -rotate-[1.6deg] rounded-card ${SHEET[sheets[1]]}`} />
      <article
        aria-label={label}
        className="relative flex min-h-0 flex-1 flex-col rounded-card border-[1.5px] border-line-strong bg-surface shadow-card"
      >
        <Ring />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-6">
          {children}
          <div aria-hidden="true" className="flex min-h-6 flex-1 flex-col justify-end overflow-hidden pb-6">
            <div className="flex flex-col gap-7">
              {Array.from({ length: rules }, (_, i) => (
                <div key={i} className="h-px shrink-0 bg-paper-rule" />
              ))}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

/** A ruled line across the card between its parts. */
export function Rule({ className }: { className?: string }) {
  return <div aria-hidden="true" className={`h-px w-full shrink-0 bg-paper-rule ${className ?? ""}`} />;
}
