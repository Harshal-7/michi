"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { IconButton } from "./icon-button";
import { ProgressBar } from "./progress";

/**
 * The top of a session (review, quiz, quick check, a lesson reader, a game in play), which hides the
 * bottom bar: close on the left, the title and count in the middle, an optional icon button on the
 * right, and B's ticked progress bar under it. The heading takes focus when the session opens, so a
 * screen reader starts there.
 *
 * @example
 * <SessionHeader title="Reviews" count="7 / 18" close={{ href: "/", label: "Close reviews" }}
 *   progress={{ value: 7, max: 18, label: "Card 7 of 18" }}
 *   trailing={<IconButton icon="flag" label="Flag this card" onClick={flag} />} />
 */
export function SessionHeader({
  title,
  count,
  close,
  progress,
  trailing,
  focusOnOpen = true,
  session = true,
}: {
  /** The session's name ("Reviews", "Daily quiz"); the page's h1. */
  title: ReactNode;
  /** The quiet count after it ("7 / 18"). */
  count?: ReactNode;
  /** The close button: a link (`href`) or an action (`onClick`), with its label ("Close reviews"). */
  close: { label: string; href?: string; onClick?: () => void };
  /** The ticked bar under the row. */
  progress?: { value: number; max: number; label: string };
  /** An icon button on the right (flag, settings). */
  trailing?: ReactNode;
  /** Moves focus to the heading on mount. */
  focusOnOpen?: boolean;
  /** Marks the page as a session, which hides the phone's bottom bar. Off only for previews (/design). */
  session?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnOpen) heading.current?.focus({ preventScroll: true });
  }, [focusOnOpen]);
  return (
    <header data-session={session ? "" : undefined} className="flex flex-col gap-2">
      <div className="grid grid-cols-[48px_1fr_48px] items-center gap-2">
        <IconButton icon="close" label={close.label} href={close.href} onClick={close.onClick} />
        <h1 ref={heading} tabIndex={-1} className="m-0 flex items-baseline justify-center gap-2 text-center text-lead font-bold outline-none">
          <span className="truncate">{title}</span>
          {count !== undefined && <span className="text-meta font-medium whitespace-nowrap text-ink2">{count}</span>}
        </h1>
        <span className="flex justify-end">{trailing}</span>
      </div>
      {progress && <ProgressBar {...progress} className="mx-2" />}
    </header>
  );
}
