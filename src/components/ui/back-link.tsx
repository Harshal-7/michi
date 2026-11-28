import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "./icon";

/**
 * "‹ Learn": the quiet back link at the top of a page one level down. Accent text, 44 tall.
 *
 * @example <BackLink href="/learn">Learn</BackLink>
 */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-1.5 inline-flex h-11 items-center gap-1 self-start rounded-pill pr-2.5 pl-1 text-body font-bold text-accent no-underline hover:bg-accent-soft"
    >
      <Icon name="chevron-left" size={20} />
      <span>{children}</span>
    </Link>
  );
}
