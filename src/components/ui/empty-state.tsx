import type { ReactNode } from "react";

/**
 * When a page can't show its usual thing: an illustration (a Spot or the Rabbit), a 22/900 title, a
 * calm line or two, and one way on. Plain words, no blame. Without `title` and `art` it's the compact
 * version: one quiet line in a dashed box, for an empty list inside a page.
 *
 * @example
 * <EmptyState art={<Spot kind="notebook" />} title="Nothing to review right now"
 *   action={<Button variant="quiet" href="/">Back to Today</Button>}>
 *   The next 14 cards come back tomorrow morning.
 * </EmptyState>
 * <EmptyState>No mistakes saved yet.</EmptyState>
 */
export function EmptyState({
  art,
  title,
  children,
  action,
  className,
}: {
  /** The picture, about 160 wide (decoration). */
  art?: ReactNode;
  /** One short heading. */
  title?: ReactNode;
  /** The calm line under it. */
  children?: ReactNode;
  /** One way on: a Button (quiet or primary). */
  action?: ReactNode;
  className?: string;
}) {
  if (!title && !art) {
    return (
      <div className={`flex items-center gap-3 rounded-card border-[1.5px] border-dashed border-line-strong px-4 py-3.5 ${className ?? ""}`}>
        <p className="m-0 flex-auto text-body text-ink2">{children}</p>
        {action}
      </div>
    );
  }
  return (
    <section className={`flex flex-col items-center gap-3 px-2 py-8 text-center ${className ?? ""}`}>
      {art}
      {title && <h2 className="m-0 mt-3 text-title font-black">{title}</h2>}
      {children && <div className="max-w-sm text-body text-ink2">{children}</div>}
      {action && <div className="mt-2 flex flex-col items-center gap-2">{action}</div>}
    </section>
  );
}
