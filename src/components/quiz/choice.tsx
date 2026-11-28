import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";

/**
 * One answer option (RF_QuizQuestion): 64 tall, radius 16, a keycap with its number, the option, and
 * once answered "Right" in good or "Yours" in again. Keys 1–4 are the caller's.
 */
export function Choice({
  n,
  state = "idle",
  pressed,
  disabled,
  onClick,
  children,
}: {
  /** The option's number (1–4), shown as a keycap. */
  n: number;
  /** idle · right (the answer) · wrong (picked, not the answer) · quiet (answered, neither). */
  state?: "idle" | "right" | "wrong" | "quiet";
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const edge = {
    idle: "border-[1.5px] border-line-strong hover:bg-surface2",
    right: "border-2 border-good bg-good-soft text-on-cover",
    wrong: "border-2 border-again bg-again-soft text-on-cover",
    quiet: "border-[1.5px] border-line text-ink2",
  }[state];
  return (
    <button
      type="button"
      aria-keyshortcuts={String(n)}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-16 w-full items-center gap-4 rounded-btn-lg bg-surface px-4 py-2 text-left text-ink transition-colors duration-120 disabled:cursor-default ${edge}`}
    >
      <kbd
        aria-hidden="true"
        className="inline-grid h-7 min-w-7 shrink-0 place-items-center rounded-box border-[1.5px] border-b-[3px] border-line-strong bg-surface px-1.5 font-ui text-meta leading-none font-bold text-ink2"
      >
        {n}
      </kbd>
      <span className="min-w-0 flex-1">{children}</span>
      {state === "right" && (
        <span className="inline-flex shrink-0 items-center gap-1 text-meta font-bold text-good">
          <Icon name="check" size={18} stroke={2.4} />
          Right
        </span>
      )}
      {state === "wrong" && (
        <span className="inline-flex shrink-0 items-center gap-1 text-meta font-bold text-again">
          <Icon name="close" size={18} stroke={2.4} />
          Yours
        </span>
      )}
    </button>
  );
}

/** Three or four big soft buttons in a row, the grade-button look (RF_QuickCheck's Forgot / Unsure / Knew it). */
export function VerdictButtons<V extends string>({
  label,
  options,
  onChoose,
}: {
  label: string;
  options: { value: V; label: string; hint: string; fill: "again" | "warn" | "good" | "easy" }[];
  onChoose: (value: V) => void;
}) {
  const FILL = { again: "bg-again-soft", warn: "bg-warn-soft", good: "bg-good-soft", easy: "bg-easy-soft" };
  return (
    <div role="group" aria-label={label} className="grid grid-cols-3 gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChoose(o.value)}
          className={`flex h-18 min-w-0 flex-col items-center justify-center gap-1.25 rounded-grade border-0 p-0 text-on-cover shadow-grade transition-transform duration-120 active:translate-y-px ${FILL[o.fill]}`}
        >
          <span className="text-body leading-none font-black">{o.label}</span>
          <span className="text-meta leading-none font-bold text-on-cover2">{o.hint}</span>
        </button>
      ))}
    </div>
  );
}
