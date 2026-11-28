import type { ReactNode } from "react";

import { formatLong, studyDate } from "@/lib/day";

import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

/**
 * A page that isn't built yet: its header and a calm empty state that says plainly what's coming
 * (and roughly when). Give it a picture (a Spot or the Rabbit) for the full empty state.
 *
 * @example <Stub title="Log" art={<Rabbit pose="sleepy" />} empty="Minutes from listening and speaking land here in January." />
 */
export function Stub({
  title,
  sub = formatLong(studyDate()),
  kicker,
  size,
  art,
  emptyTitle,
  empty,
  children,
}: {
  title: string;
  /** The line under the title (the date by default); null drops it. */
  sub?: ReactNode;
  /** @deprecated Use `sub`. */
  kicker?: ReactNode;
  /** @deprecated Ignored. */
  size?: "lg" | "md";
  /** The empty state's picture. */
  art?: ReactNode;
  /** The empty state's heading. */
  emptyTitle?: ReactNode;
  /** What's coming, in a sentence. */
  empty: ReactNode;
  children?: ReactNode;
}) {
  void size;
  return (
    <>
      <PageHeader title={title} sub={kicker !== undefined ? kicker : sub} />
      <EmptyState art={art} title={emptyTitle}>
        {empty}
      </EmptyState>
      {children}
    </>
  );
}
