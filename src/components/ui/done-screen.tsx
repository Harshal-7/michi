import type { ReactNode } from "react";

import { Rabbit } from "./art/rabbit";
import { Hanamaru } from "./art/rewards";

/**
 * The end of a session (RF_ReviewDone, RF_QuizResults, RF_PlayDone): a picture, a 28/900 title, a calm
 * line, the numbers, and the way on. With `hanamaru`, the title sits inside the red-pencil ring as it
 * draws, with よくできました under it ("Done for today", RF_TodayDone).
 *
 * @example
 * <DoneScreen title="18 cards done" art={<Spot kind="lantern" />}
 *   stats={<StatGrid cols={3}>…</StatGrid>}
 *   actions={<Button size="lg" full iconEnd="arrow-right" href="/">Back to Today</Button>}>
 *   Your grades are saved.
 * </DoneScreen>
 * <DoneScreen hanamaru title={<>Done for<br />today</>} />
 */
export function DoneScreen({
  title,
  children,
  art,
  hanamaru = false,
  stats,
  actions,
  className,
}: {
  /** The heading (an h2: the session's h1 stays in SessionHeader). */
  title: ReactNode;
  /** The calm line under it. */
  children?: ReactNode;
  /** The picture above (default: the cheering rabbit). Ignored with `hanamaru`. */
  art?: ReactNode;
  /** Draw the red-pencil ring round the title, with よくできました under it. */
  hanamaru?: boolean;
  /** The numbers (a StatGrid), on their own row. */
  stats?: ReactNode;
  /** The way on: one primary Button, maybe a quiet one under it. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col items-center gap-4 py-6 text-center ${className ?? ""}`}>
      {hanamaru ? (
        <div className="relative h-50.5 w-60 shrink-0">
          <Hanamaru width={240} className="absolute top-0 left-0" />
          <h2 className="absolute inset-x-0 top-0 m-0 grid h-43 place-items-center text-headline font-black">{title}</h2>
          <p lang="ja" className="absolute inset-x-0 top-42 m-0 -rotate-4 font-ja text-title whitespace-nowrap text-hanamaru">
            よくできました
          </p>
        </div>
      ) : (
        <>
          {art ?? <Rabbit pose="cheering" size={180} />}
          <h2 className="m-0 text-headline font-black">{title}</h2>
        </>
      )}
      {children && <div className="max-w-md text-body text-ink2">{children}</div>}
      {stats && <div className="w-full max-w-md">{stats}</div>}
      {actions && <div className="flex w-full max-w-md flex-col items-center gap-2">{actions}</div>}
    </section>
  );
}
