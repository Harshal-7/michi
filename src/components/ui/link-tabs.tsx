import Link from "next/link";

/**
 * Tabs that are links, one per page (hiragana / katakana, N5 / N4 / N3), drawn like the Segmented
 * control: a surface2 track, the current tab raised. Use Segmented for a choice inside one page.
 *
 * @example <LinkTabs label="Script" tabs={[{ href: "/learn/kana/hiragana", label: "Hiragana", current: true }, …]} />
 */
export function LinkTabs({
  label,
  tabs,
}: {
  /** Names the set for screen readers ("Script", "Level"). */
  label: string;
  /** Each tab: where it goes, its label, an optional small note under it, and whether it's this page. */
  tabs: { href: string; label: string; note?: string; current: boolean }[];
}) {
  return (
    <nav
      aria-label={label}
      className="grid gap-1 rounded-track border-[1.5px] border-line bg-surface2 p-1"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.current ? "page" : undefined}
          className={`flex min-h-11 flex-col items-center justify-center rounded-seg px-2 text-body leading-tight no-underline ${
            t.current ? "bg-raised font-black text-ink shadow-seg" : "font-bold text-ink2 hover:text-ink"
          }`}
        >
          <span>{t.label}</span>
          {t.note && <span className="text-caption font-medium text-ink2">{t.note}</span>}
        </Link>
      ))}
    </nav>
  );
}
