import type { ReactNode } from "react";

import { Icon } from "./icon";

export type Cover = "blue" | "mint" | "butter" | "pink" | "lilac" | "aqua" | "peri";

/** Cover fills for chips, tiles and checkboxes (static strings so Tailwind sees them). */
export const COVER_BG: Record<Cover, string> = {
  blue: "bg-cover-blue",
  mint: "bg-cover-mint",
  butter: "bg-cover-butter",
  pink: "bg-cover-pink",
  lilac: "bg-cover-lilac",
  aqua: "bg-cover-aqua",
  peri: "bg-cover-peri",
};

/** Cover-coloured borders (an emptied checkbox once its task is done). */
export const COVER_BORDER: Record<Cover, string> = {
  blue: "border-cover-blue",
  mint: "border-cover-mint",
  butter: "border-cover-butter",
  pink: "border-cover-pink",
  lilac: "border-cover-lilac",
  aqua: "border-cover-aqua",
  peri: "border-cover-peri",
};

/** The deeper tone of each cover: checkbox rims, sticker faces, glyphs. */
export const COVER_TONE_BORDER: Record<Cover, string> = {
  blue: "border-tone-blue",
  mint: "border-tone-mint",
  butter: "border-tone-butter",
  pink: "border-tone-pink",
  lilac: "border-tone-lilac",
  aqua: "border-tone-aqua",
  peri: "border-tone-peri",
};

/**
 * A small label. Cover chips are index tabs (radius 7 7 7 2) in a notebook-cover colour: "must-do"
 * (butter), "Word · N5" (blue), "i-adjective" (mint). `count` is the accent-soft pill ("18"); `soon` the
 * outlined pill. 24 tall, 12px 700; `size="lg"` is 28/14 (the review card).
 *
 * @example <Chip cover="butter">must-do</Chip>  <Chip kind="count">18</Chip>  <Chip kind="soon">Soon</Chip>
 */
export function Chip({
  cover = "blue",
  kind = "cover",
  size = "sm",
  ja,
  children,
  className,
}: {
  /** The cover colour (cover chips only). */
  cover?: Cover;
  /** cover: index tab · count: accent-soft pill · soon: outlined pill. */
  kind?: "cover" | "count" | "soon";
  /** sm 24 tall · lg 28 tall. */
  size?: "sm" | "lg";
  /** Marks the text as Japanese. */
  ja?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const shape = {
    cover: `rounded-chip ${COVER_BG[cover]} text-on-cover`,
    count: "rounded-pill bg-accent-soft text-accent",
    soon: "rounded-pill border-[1.5px] border-line bg-surface text-ink2",
  }[kind];
  const sz = size === "lg" ? "h-7 px-2.5 text-meta" : "h-6 px-2.25 text-caption";
  return (
    <span
      lang={ja ? "ja" : undefined}
      className={`inline-flex shrink-0 items-center leading-none font-bold whitespace-nowrap ${sz} ${shape} ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

export type ChoiceOption<V extends string> = { value: V; label: ReactNode; ja?: boolean };

type ChoiceValue<V extends string> =
  | {
      /** One on at a time (default). */
      multiple?: false;
      /** The value that's on. */
      value: V;
      onChange: (value: V) => void;
    }
  | {
      /** Several on at once. */
      multiple: true;
      /** The values that are on. */
      value: V[];
      onChange: (value: V[]) => void;
    };

/**
 * Filter chips: toggle buttons 44 tall, one or several on. On = cover-blue with a tick, 900. Use for
 * filters and pickers (N5 / N4, hiragana rows); use Segmented for 2–4 exclusive settings. With `name`,
 * hidden inputs carry the choice in a <form>.
 *
 * @example <ChoiceChips label="Level" options={levels} value={level} onChange={setLevel} />
 * <ChoiceChips label="Rows" multiple options={rows} value={picked} onChange={setPicked} />
 */
export function ChoiceChips<V extends string>(
  props: {
    /** Names the group for screen readers. */
    label: string;
    options: ChoiceOption<V>[];
    /** Form field name for hidden inputs. */
    name?: string;
    disabled?: boolean;
    className?: string;
  } & ChoiceValue<V>,
) {
  const { label, options, name, disabled, className } = props;
  const values: V[] = props.multiple ? props.value : [props.value];
  const toggle = (v: V) => {
    if (!props.multiple) return props.onChange(v);
    props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
  };
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap gap-2 ${className ?? ""}`}>
      {options.map((o) => {
        const on = values.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => toggle(o.value)}
            className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill border-[1.5px] px-4 text-body leading-none transition-colors duration-120 disabled:text-ink3 ${
              on ? "border-cover-blue bg-cover-blue font-black text-on-cover" : "border-line-strong bg-surface font-bold text-ink hover:bg-surface2"
            }`}
          >
            {on && <Icon name="check" size={18} stroke={2.4} />}
            <span lang={o.ja ? "ja" : undefined}>{o.label}</span>
          </button>
        );
      })}
      {name && values.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
    </div>
  );
}
