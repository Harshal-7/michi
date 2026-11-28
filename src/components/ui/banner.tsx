import type { ReactNode } from "react";

import { Icon, type IconName } from "./icon";

const KIND = {
  // No signal: a quiet surface2 strip.
  offline: { bg: "bg-surface2 text-ink", body: "text-ink2", icon: "offline" },
  // Grades waiting to save: butter cover (pair it with the tea spot).
  waiting: { bg: "bg-cover-butter text-on-cover", body: "text-on-cover2", icon: "cloud-up" },
  // A new version is ready: accent-soft with a Reload button.
  version: { bg: "bg-accent-soft text-ink", body: "text-ink2", icon: "refresh" },
  // Anything else worth a calm note.
  info: { bg: "bg-surface2 text-ink", body: "text-ink2", icon: "info" },
} as const satisfies Record<string, { bg: string; body: string; icon: IconName }>;

/**
 * A status strip above the content: radius 16, at least 54 tall, an icon in a snow disc, a bold line
 * and an optional quieter one, and an optional action on the right. Calm words, no blame; a banner,
 * never a pop-up.
 *
 * @example
 * <Banner kind="offline" title="You’re offline">Reviews still work. Grades save here first.</Banner>
 * <Banner kind="version" title="A new version is ready" action={<Button size="sm" onClick={reload}>Reload</Button>} />
 */
export function Banner({
  kind = "info",
  title,
  children,
  action,
  icon,
  role = "status",
  className,
}: {
  /** offline · waiting (grades waiting to save) · version (new version, reload) · info. */
  kind?: keyof typeof KIND;
  /** The bold line. */
  title: ReactNode;
  /** The quieter line under it. */
  children?: ReactNode;
  /** A button on the right (Reload, OK). */
  action?: ReactNode;
  /** Another icon than the kind's own. */
  icon?: IconName;
  /** status (default) or alert for something that needs doing now. */
  role?: "status" | "alert";
  className?: string;
}) {
  const k = KIND[kind];
  return (
    <div role={role} className={`flex min-h-13.5 items-center gap-3 rounded-btn-lg px-3 py-1.75 ${k.bg} ${className ?? ""}`}>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-snow text-on-cover">
        <Icon name={icon ?? k.icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body font-bold">{title}</span>
        {children && <span className={`text-meta ${k.body}`}>{children}</span>}
      </span>
      {action}
    </div>
  );
}
