import Link from "next/link";

/**
 * The segmented control from F_Grammar's level picker, as links: one tab per page (hiragana /
 * katakana, N5 / N4 / N3). The current tab is a raised surface pill.
 */
export function LinkTabs({ label, tabs }: { label: string; tabs: { href: string; label: string; note?: string; current: boolean }[] }) {
  return (
    <nav aria-label={label} className="grid gap-1 rounded-btn bg-surface2 p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.current ? "page" : undefined}
          className={`flex min-h-11 flex-col items-center justify-center rounded-btn text-sm leading-[1.2] no-underline ${
            t.current ? "bg-surface font-bold text-ink shadow-card" : "font-medium text-ink2"
          }`}
        >
          <span>{t.label}</span>
          {t.note && <span className="text-[11px] font-medium">{t.note}</span>}
        </Link>
      ))}
    </nav>
  );
}

/** "‹ Learn": the quiet back link at the top of a lesson page (F_GrammarPoint). */
export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 self-start text-[13px] text-ink2 no-underline">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      {children}
    </Link>
  );
}
