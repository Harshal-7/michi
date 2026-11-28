"use client";

/** Small parts every game's start and end screens share. */

export function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-[13px] font-bold">{label}</p>
      {children}
      {note && <p className="m-0 text-[12.5px] text-ink2">{note}</p>}
    </div>
  );
}

/** The segmented control from Settings: equal segments in a `--surface2` track. */
export function Segmented({
  name,
  legend,
  value,
  options,
  onChoose,
}: {
  name: string;
  legend: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChoose: (value: string) => void;
}) {
  return (
    <fieldset className="m-0 border-none p-0">
      <legend className="sr-only">{legend}</legend>
      <div className="grid gap-1 rounded-btn bg-surface2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([v, text]) => (
          <label
            key={v}
            className="relative inline-flex min-h-10 cursor-pointer items-center justify-center rounded-btn px-2 text-[13.5px] font-medium text-ink2 has-[:checked]:bg-surface has-[:checked]:font-bold has-[:checked]:text-ink has-[:checked]:shadow-card has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
          >
            <input type="radio" name={name} value={v} checked={v === value} onChange={() => onChoose(v)} className="sr-only" />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A number with its label and an optional note, in a `--surface2` well. */
export function Tile({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-[14px] bg-surface2 px-1.5 py-2.5 text-center">
      <span className="text-xl font-bold">{value}</span>
      <span className="text-[12.5px] font-bold text-ink2">{label}</span>
      {note && <span className="text-[11px] text-ink2">{note}</span>}
    </div>
  );
}

/** "3 runs waiting to save", on the start screen. */
export function WaitingChip({ waiting }: { waiting: number }) {
  if (waiting === 0) return null;
  return (
    <p role="status" className="m-0 self-start rounded-full border border-warn bg-surface px-3 py-1.5 text-[12.5px] font-bold text-warn">
      {waiting === 1 ? "1 game" : `${waiting} games`} waiting to save
    </p>
  );
}
