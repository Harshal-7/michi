import Link from "next/link";
import type { ReactNode } from "react";

import { Tick } from "./art/rewards";
import { type Cover, COVER_BG, COVER_BORDER, COVER_TONE_BORDER } from "./chip";
import { Icon, type IconName } from "./icon";

/**
 * A list of rows (`<ul>`), each row a ListRow. Rows are divided by a 1.5px line, the last one without.
 *
 * @example <List aria-label="Today’s plan">{tasks.map((t) => <ListRow key={t.id} … />)}</List>
 */
export function List({ children, className, ...rest }: { children: ReactNode; className?: string; "aria-label"?: string; "aria-labelledby"?: string }) {
  return (
    <ul className={`m-0 flex list-none flex-col p-0 ${className ?? ""}`} {...rest}>
      {children}
    </ul>
  );
}

/** The cover checkbox at the start of a plan row: to do, done (the red-pencil tick), or locked. */
export function CoverCheck({ cover, state }: { cover: Cover; state: "todo" | "done" | "locked" }) {
  if (state === "locked") {
    return (
      <span aria-hidden="true" className="grid size-6.5 shrink-0 place-items-center rounded-box border-2 border-dashed border-line-strong text-ink3">
        <Icon name="lock" size={14} stroke={2.2} />
      </span>
    );
  }
  if (state === "done") {
    return (
      <span aria-hidden="true" className={`relative size-6.5 shrink-0 rounded-box border-2 ${COVER_BORDER[cover]}`}>
        <span className="absolute -top-2.5 -left-0.5">
          <Tick size={32} />
        </span>
      </span>
    );
  }
  return <span aria-hidden="true" className={`size-6.5 shrink-0 rounded-box border-2 ${COVER_TONE_BORDER[cover]} ${COVER_BG[cover]}`} />;
}

/** The icon tile at the start of a More row: 52px, a cover colour, the icon in ink. Dashed when it isn't open yet. */
export function IconTile({ icon, cover, waiting = false }: { icon: IconName; cover?: Cover; waiting?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-13 shrink-0 place-items-center rounded-btn ${
        waiting ? "border-2 border-dashed border-line-strong text-ink3" : `${cover ? COVER_BG[cover] : "bg-surface2"} text-on-cover`
      }`}
    >
      <Icon name={icon} size={22} />
    </span>
  );
}

type Lead =
  | { check: Cover; state?: "todo" | "done" | "locked" }
  | { icon: IconName; cover?: Cover; waiting?: boolean }
  | { node: ReactNode };

/**
 * One row: something at the start (a cover checkbox, an icon tile, or anything), a 16/700 title with an
 * optional chip, a 14px meta line, and a chevron when it goes somewhere. 60 tall at least. Done rows
 * show the red tick and end their meta in "· done"; locked and waiting rows are quiet and don't link.
 *
 * @example
 * <ListRow href="/quiz" lead={{ check: "mint" }} title="Daily quiz" chip={<Chip cover="butter">must-do</Chip>} meta="10 questions · about 6 min" />
 * <ListRow href="/progress" lead={{ icon: "progress", cover: "blue" }} title="Progress" meta="a year of reviews, day by day" />
 */
export function ListRow({
  href,
  onClick,
  lead,
  title,
  chip,
  meta,
  trailing,
  chevron,
  disabled = false,
  current = false,
  ja,
}: {
  /** Where the row goes (a Next <Link>). */
  href?: string;
  /** Or what it does (a <button>). */
  onClick?: () => void;
  /** What sits at the start. */
  lead?: Lead;
  title: ReactNode;
  /** A chip after the title ("must-do"). */
  chip?: ReactNode;
  /** The line under the title. */
  meta?: ReactNode;
  /** Something at the end instead of (or before) the chevron: a Soon chip, a count, a Switch. */
  trailing?: ReactNode;
  /** The chevron at the end; on by default for rows that link or act. */
  chevron?: boolean;
  /** Locked or not open yet: quiet ink, no link. */
  disabled?: boolean;
  /** Highlights the row (the plan's next task on a laptop). */
  current?: boolean;
  /** Marks the title as Japanese. */
  ja?: boolean;
}) {
  const done = lead && "check" in lead && lead.state === "done";
  const quiet = disabled || (lead && "check" in lead && lead.state === "locked");
  const showChevron = (chevron ?? Boolean(href || onClick)) && !quiet;
  const body = (
    <>
      {lead &&
        ("check" in lead ? (
          <CoverCheck cover={lead.check} state={lead.state ?? "todo"} />
        ) : "icon" in lead ? (
          <IconTile icon={lead.icon} cover={lead.cover} waiting={lead.waiting} />
        ) : (
          lead.node
        ))}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span lang={ja ? "ja" : undefined} className={`text-body font-bold ${quiet ? "text-ink3" : done ? "text-ink2" : "text-ink"}`}>
            {title}
          </span>
          {chip}
        </span>
        {meta !== undefined && <span className={`text-meta ${quiet ? "text-ink3" : "text-ink2"}`}>{meta}</span>}
      </span>
      {trailing}
      {showChevron && <Icon name="chevron-right" size={20} className="text-ink3" />}
    </>
  );
  const row = `flex min-h-15 w-full items-center gap-3.5 py-1.5 text-left no-underline`;
  const live = `-mx-2.5 rounded-btn px-2.5 transition-colors duration-120 hover:bg-surface2 ${current ? "bg-surface2" : ""}`;
  return (
    <li className="border-b-[1.5px] border-line last:border-b-0">
      {href && !quiet ? (
        <Link href={href} className={`${row} ${live}`}>
          {body}
        </Link>
      ) : onClick && !quiet ? (
        <button type="button" onClick={onClick} className={`${row} ${live} border-0 bg-transparent`}>
          {body}
        </button>
      ) : (
        <div className={row} aria-disabled={quiet || undefined}>
          {body}
        </div>
      )}
    </li>
  );
}
