import type { ReactNode } from "react";

import { formatLong, studyDate } from "@/lib/day";

import { EmptyState, PageHeader } from "./page";

/** A screen that later rounds fill in: its header and the empty state. `kicker={null}` drops the date line. */
export function Stub({
  title,
  kicker = formatLong(studyDate()),
  size,
  empty,
  children,
}: {
  title: string;
  kicker?: ReactNode;
  size?: "lg" | "md";
  empty: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <PageHeader kicker={kicker} title={title} size={size} />
      <EmptyState>{empty}</EmptyState>
      {children}
    </>
  );
}
