"use client";
// design-lint: legacy

/** Small parts every game's start and end screens share. */

export function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-sm font-black">{label}</p>
      {children}
      {note && <p className="m-0 text-[12.5px] text-ink2">{note}</p>}
    </div>
  );
}

/** The segmented control: equal segments in a `--surface2` track, the chosen one raised. */
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
      <div className="grid gap-1 rounded-btn bg-surface2 p-[5px]" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(([v, text]) => (
          <label
            key={v}
            className="relative inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-btn px-2 text-sm font-medium text-ink2 has-[:checked]:bg-surface has-[:checked]:font-black has-[:checked]:text-ink has-[:checked]:shadow-card has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
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

/**
 * A game's modes on its start screen ("Game mode"): wide cards, each with a small preview of how
 * it plays, its name and one line. One under the other on a phone, side by side on wider screens;
 * the picked one has a border in the game's colour.
 */
export function ModeCards({
  modes,
}: {
  modes: { key: string; preview: React.ReactNode; label: string; note: string; on: boolean; onPick: () => void }[];
}) {
  return (
    <section aria-label="Game mode" className="flex flex-col gap-2.5">
      <h2 className="m-0 text-xs font-black tracking-[0.12em] text-ink2 uppercase">Game mode</h2>
      <div role="radiogroup" aria-label="Game mode" className="grid gap-2.5 min-[560px]:grid-cols-2 laptop:gap-3">
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={m.on}
            onClick={m.onPick}
            className={`flex items-center gap-3 rounded-[20px] border-2 p-2.5 text-left laptop:gap-4 laptop:p-3 ${
              m.on ? "border-hue bg-surface shadow-card" : "border-transparent bg-surface2"
            }`}
          >
            <span aria-hidden="true" className="inline-flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-surface2 text-[22px] font-black laptop:size-16 laptop:text-2xl">
              {m.preview}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={`text-base leading-tight laptop:text-[17px] ${m.on ? "font-black" : "font-bold text-ink2"}`}>{m.label}</span>
              <span className="text-[12.5px] leading-snug text-ink2 laptop:text-[13px]">{m.note}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * A group of choices on a game's start screen, the way every game sets up (Kanago-style): a small
 * heading, then equal tiles with a glyph and a label. `multi` tiles toggle; the others pick one.
 */
export function OptionTiles({
  label,
  options,
  multi = false,
  note,
}: {
  label: string;
  options: { key: string; glyph: React.ReactNode; label: string; on: boolean; onPick: () => void; disabled?: boolean }[];
  multi?: boolean;
  note?: string;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-2.5">
      <h2 className="m-0 text-xs font-black tracking-[0.12em] text-ink2 uppercase">{label}</h2>
      <div role={multi ? "group" : "radiogroup"} aria-label={label} className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role={multi ? undefined : "radio"}
            aria-checked={multi ? undefined : o.on}
            aria-pressed={multi ? o.on : undefined}
            disabled={o.disabled}
            onClick={o.onPick}
            className={`flex min-h-[76px] flex-col items-center justify-center gap-0.5 rounded-[18px] border-2 px-1.5 py-2 disabled:opacity-40 ${
              o.on ? "border-hue bg-surface shadow-card" : "border-transparent bg-surface2"
            }`}
          >
            <span aria-hidden="true" className="text-[23px] leading-[1.15] font-black">
              {o.glyph}
            </span>
            <span className={`text-[13.5px] leading-tight ${o.on ? "font-black text-ink" : "font-bold text-ink2"}`}>{o.label}</span>
          </button>
        ))}
      </div>
      {note && <p className="m-0 text-[12.5px] text-ink2">{note}</p>}
    </section>
  );
}

/** Japanese in a tile's glyph: Mincho, marked as Japanese. */
export function Ja({ children }: { children: string }) {
  return (
    <span lang="ja" className="font-card">
      {children}
    </span>
  );
}
