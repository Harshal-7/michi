"use client";

/** Small parts every game's start and end screens share (RF_PlayKanaStart, RF_PlayDone). */
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";

/** A group's heading on a start screen: "Game mode", "Writing system". */
function GroupTitle({ id, children }: { id?: string; children: string }) {
  return (
    <h2 id={id} className="m-0 mb-2 text-meta font-bold text-ink">
      {children}
    </h2>
  );
}

/** A number with its label (and a quieter note) in a surface2 well: "44/46 · right first". Goes in a <dl>. */
export function Tile({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-btn bg-surface2 px-0.5 py-2.25 text-center">
      <dd className="order-1 m-0 text-lead font-black tabular-nums">{value}</dd>
      <dt className="order-2 text-caption text-ink2">{label}</dt>
      {note && <dd className="order-3 m-0 text-caption text-ink2">{note}</dd>}
    </div>
  );
}

/** "3 games waiting to save", on the start screen. */
export function WaitingChip({ waiting }: { waiting: number }) {
  if (waiting === 0) return null;
  return (
    <p role="status" className="m-0">
      <Chip cover="butter">{waiting === 1 ? "1 game" : `${waiting} games`} waiting to save</Chip>
    </p>
  );
}

/** The round mark in a picked card's corner: an accent disc with a tick, or an empty ring. */
function PickMark({ on }: { on: boolean }) {
  return on ? (
    // design-lint-ignore-next-line accent-button: a radio's mark inside a card, not a button
    <span aria-hidden="true" className="absolute top-2.5 right-2.5 grid size-6 place-items-center rounded-full bg-accent text-on-accent">
      <Icon name="check" size={16} stroke={2.6} />
    </span>
  ) : (
    <span aria-hidden="true" className="absolute top-2.5 right-2.5 size-6 rounded-full border-2 border-line-strong" />
  );
}

/**
 * A game's modes on its start screen ("Game mode"): two cards side by side, each with a small
 * preview of how it plays, its name and one line; the picked one is cover-blue with the accent rim.
 */
export function ModeCards({
  modes,
}: {
  modes: { key: string; preview: React.ReactNode; label: string; note: string; on: boolean; onPick: () => void }[];
}) {
  return (
    <section aria-labelledby="game-mode">
      <GroupTitle id="game-mode">Game mode</GroupTitle>
      <div role="radiogroup" aria-labelledby="game-mode" className="grid grid-cols-2 gap-2.5 laptop:gap-3">
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            role="radio"
            aria-checked={m.on}
            onClick={m.onPick}
            className={`relative flex min-h-26 flex-col items-start gap-1 rounded-btn-lg px-3.5 py-2.5 text-left transition-colors duration-120 ${
              m.on ? "border-2 border-accent bg-cover-blue text-on-cover" : "border-[1.5px] border-line-strong bg-surface text-ink hover:bg-surface2"
            }`}
          >
            <PickMark on={m.on} />
            <span aria-hidden="true" className="flex h-8.5 items-center text-headline font-black">
              {m.preview}
            </span>
            <span className="text-lead font-black">{m.label}</span>
            <span className={`text-meta ${m.on ? "text-on-cover2" : "text-ink2"}`}>{m.note}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * A group of choices on a game's start screen: a small heading, then equal tiles with a glyph and a
 * label. `multi` tiles toggle; the others pick one. On = cover-blue with the accent rim.
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
    <section aria-label={label}>
      <GroupTitle>{label}</GroupTitle>
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
            className={`flex h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-btn-lg px-1 transition-colors duration-120 disabled:text-ink3 ${
              o.on ? "border-2 border-accent bg-cover-blue text-on-cover" : "border-[1.5px] border-line-strong bg-surface text-ink hover:bg-surface2"
            }`}
          >
            <span aria-hidden="true" className="text-title leading-tight">
              {o.glyph}
            </span>
            <span className={`max-w-full truncate text-meta ${o.on ? "font-black" : "font-bold"}`}>{o.label}</span>
          </button>
        ))}
      </div>
      {note && <p className="m-0 mt-2 text-meta text-ink2">{note}</p>}
    </section>
  );
}

/** Japanese in a tile or card: the pencil hand, marked as Japanese. */
export function Ja({ children }: { children: string }) {
  return (
    <span lang="ja" className="font-ja">
      {children}
    </span>
  );
}
