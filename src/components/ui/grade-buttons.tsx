import type { ReactNode } from "react";

export type Grade = 1 | 2 | 3 | 4;

const GRADES: { grade: Grade; label: string; fill: string }[] = [
  { grade: 1, label: "Again", fill: "bg-again-soft" },
  { grade: 2, label: "Hard", fill: "bg-warn-soft" },
  { grade: 3, label: "Good", fill: "bg-good-soft" },
  { grade: 4, label: "Easy", fill: "bg-easy-soft" },
];

/**
 * The four grade buttons on a review card's back: 72 tall, soft state fills, the next interval under
 * each label. Keys 1–4 are the caller's (aria-keyshortcuts is set here). They fit 375 wide.
 *
 * @example <GradeButtons intervals={["1 min", "8 min", "3 days", "9 days"]} onGrade={grade} disabled={saving} />
 */
export function GradeButtons({
  intervals,
  onGrade,
  disabled,
  label = "How well did you remember it?",
  extra,
}: {
  /** The interval under each button, Again → Easy. */
  intervals: [ReactNode, ReactNode, ReactNode, ReactNode];
  onGrade: (grade: Grade) => void;
  disabled?: boolean;
  /** The group's name for screen readers. */
  label?: string;
  /** Per-button extras (e.g. data-* hooks), by grade. */
  extra?: Partial<Record<Grade, Record<`data-${string}`, string>>>;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-4 gap-2">
      {GRADES.map((g, i) => (
        <button
          key={g.grade}
          type="button"
          aria-keyshortcuts={String(g.grade)}
          disabled={disabled}
          onClick={() => onGrade(g.grade)}
          {...extra?.[g.grade]}
          className={`flex h-18 min-w-0 flex-col items-center justify-center gap-1 rounded-grade border-0 p-0 text-on-cover shadow-grade transition-transform duration-120 active:translate-y-px disabled:opacity-60 ${g.fill}`}
        >
          <span className="text-body leading-none font-black">{g.label}</span>
          <span className="text-meta leading-none font-bold text-on-cover2">{intervals[i]}</span>
        </button>
      ))}
    </div>
  );
}
