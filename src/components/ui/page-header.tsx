import Link from "next/link";
import type { ReactNode } from "react";

import { BackLink } from "./back-link";
import { Icon } from "./icon";

/**
 * A page's title: 28px 900 on the phone, 40 on a laptop, with an optional line under it (usually the
 * date) and something on the right. No kicker labels above titles. On the phone hubs (Today, Review,
 * Learn, Practice, More) the shell puts "+ Add a word" at the top right, so leave `action` empty there.
 *
 * @example <PageHeader title="More" sub={formatLong(today)} />
 */
export function PageHeader({
  title,
  sub,
  kicker,
  action,
  back,
  size,
}: {
  /** The page's one <h1>. */
  title: ReactNode;
  /** One quiet line under the title: the date, a count, "evening session". */
  sub?: ReactNode;
  /** @deprecated The old line above the title. Shown under it now, like `sub`; use `sub`. */
  kicker?: ReactNode;
  /** Something on the right of the title (a streak badge, a quiet link). */
  action?: ReactNode;
  /** A back link above the title ("‹ More"), for pages one level down. */
  back?: { href: string; label: string };
  /** @deprecated Ignored: the scale sets the size. */
  size?: "lg" | "md";
}) {
  void size;
  const lines = [sub, kicker].filter((l) => l !== undefined && l !== null && l !== false);
  return (
    <header className="flex flex-col gap-1">
      {back && <BackLink href={back.href}>{back.label}</BackLink>}
      <div className="flex min-h-12 items-center justify-between gap-3">
        <h1 className="m-0 text-headline font-black laptop:text-display">{title}</h1>
        {action}
      </div>
      {lines.map((line, i) => (
        <p key={i} className="m-0 text-body text-ink2">
          {line}
        </p>
      ))}
    </header>
  );
}

/**
 * A section's heading, one style everywhere: 22px 700, with meta text or a quiet link on the right.
 *
 * @example <SectionTitle meta="0 of 6 done">Today’s plan</SectionTitle>
 * <SectionTitle link={{ href: "/progress", label: "See all" }}>This week</SectionTitle>
 */
export function SectionTitle({
  children,
  as: Tag = "h2",
  id,
  meta,
  link,
  action,
  className,
}: {
  children: ReactNode;
  /** h2 (default) or h3 for a section inside a section. */
  as?: "h2" | "h3";
  /** For aria-labelledby on the section. */
  id?: string;
  /** Quiet text on the right ("0 of 6 done"). */
  meta?: ReactNode;
  /** A quiet link on the right ("See all ›"). */
  link?: { href: string; label: string };
  /** Anything else on the right. */
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-h-11 items-center justify-between gap-3 ${className ?? ""}`}>
      <Tag id={id} className="m-0 text-title font-bold">
        {children}
      </Tag>
      {meta !== undefined && <span className="text-meta whitespace-nowrap text-ink2">{meta}</span>}
      {link && (
        <Link
          href={link.href}
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-pill pr-1.5 pl-2.5 text-meta font-bold whitespace-nowrap text-accent no-underline hover:bg-accent-soft"
        >
          <span>{link.label}</span>
          <Icon name="chevron-right" size={18} />
        </Link>
      )}
      {action}
    </div>
  );
}
