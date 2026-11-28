import Link from "next/link";
import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from "react";

import { Icon, type IconName } from "./icon";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "text" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex shrink-0 items-center justify-center font-bold leading-none whitespace-nowrap no-underline select-none transition-[background-color,color,transform,box-shadow] duration-120 ease-calm";

const VARIANT: Record<ButtonVariant, string> = {
  // The one action on a screen.
  primary:
    "gap-2.5 bg-accent text-on-accent shadow-btn hover:bg-accent-hover active:translate-y-px active:bg-accent-press active:shadow-none disabled:bg-surface2 disabled:text-ink3 disabled:shadow-none aria-disabled:bg-surface2 aria-disabled:text-ink3 aria-disabled:shadow-none",
  // Bordered; "+ Add a word" and second choices.
  secondary:
    "gap-2 border-[1.5px] border-line-strong bg-surface text-ink hover:bg-surface2 active:translate-y-px active:bg-accent-soft disabled:border-line disabled:bg-surface2 disabled:text-ink3 aria-disabled:border-line aria-disabled:bg-surface2 aria-disabled:text-ink3",
  // Accent text with a chevron: See all, Details, Back.
  quiet: "gap-1 text-accent hover:bg-accent-soft active:bg-accent-soft disabled:text-ink3 aria-disabled:text-ink3",
  // Plain secondary-ink text: Sign out, Skip.
  text: "gap-2 text-ink2 hover:text-ink disabled:text-ink3 aria-disabled:text-ink3",
  // Bordered, in the again colour: Delete, Reset.
  danger:
    "gap-2 border-[1.5px] border-again bg-surface text-again hover:bg-again-soft hover:text-on-cover active:translate-y-px disabled:border-line disabled:bg-surface2 disabled:text-ink3 aria-disabled:border-line aria-disabled:bg-surface2 aria-disabled:text-ink3",
};

const SIZE: Record<ButtonVariant, Record<ButtonSize, string>> = {
  primary: { sm: "h-11 rounded-pill px-4 text-meta", md: "h-12 rounded-btn px-4.5 text-body", lg: "h-14 rounded-btn-lg px-5.5 text-lead" },
  secondary: { sm: "h-11 rounded-pill px-4 text-meta", md: "h-12 rounded-btn pr-4.5 pl-3.5 text-body", lg: "h-14 rounded-btn-lg pr-5.5 pl-4.5 text-lead" },
  quiet: { sm: "h-11 rounded-pill pr-1.5 pl-2.5 text-meta", md: "h-11 rounded-pill pr-1.5 pl-2.5 text-body", lg: "h-12 rounded-pill pr-2 pl-3 text-lead" },
  text: { sm: "h-11 rounded-pill px-1 text-meta", md: "h-11 rounded-pill px-1 text-body", lg: "h-12 rounded-pill px-1 text-lead" },
  danger: { sm: "h-11 rounded-pill px-4 text-meta", md: "h-12 rounded-btn px-4.5 text-body", lg: "h-14 rounded-btn-lg px-5.5 text-lead" },
};

const ICON_SIZE: Record<ButtonSize, number> = { sm: 18, md: 20, lg: 22 };

/** The loading circle that takes the icon's place. */
export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" className="shrink-0 animate-spin">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2.6" />
      <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export type ButtonProps = {
  /**
   * primary: the one solid action per screen · secondary: bordered (+ Add a word) · quiet: accent text
   * with a chevron (See all, Back) · text: plain ink2 text (Sign out) · danger: bordered, again colour.
   */
  variant?: ButtonVariant;
  /** sm 44 tall (inline, banners) · md 48 · lg 56 (Today's hero, Show answer). */
  size?: ButtonSize;
  /** An icon before the label (accent-coloured on secondary buttons). */
  icon?: IconName;
  /** An icon after the label. Quiet buttons get a chevron unless you pass `iconEnd={null}`. */
  iconEnd?: IconName | null;
  /** Shows a spinner in place of the icon and sets aria-busy; the button stays where it is. */
  loading?: boolean;
  /** Fills its row. */
  full?: boolean;
  /** Renders a Next <Link> instead of a <button>, for actions that go somewhere. */
  href?: string;
  /** Prefetch for the link (Next's default when omitted). */
  prefetch?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className">;

/** The class names a Button uses, for the rare element that must look like one (a <label>, a <summary>). */
export function buttonClass({
  variant = "primary",
  size = "md",
  full = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; full?: boolean; className?: string } = {}) {
  return [BASE, VARIANT[variant], SIZE[variant][size], full ? "w-full" : "", className ?? ""].filter(Boolean).join(" ");
}

/**
 * Michi's button. One primary per screen. Pass `href` when it navigates.
 *
 * @example
 * <Button size="lg" icon="play" href="/review" full>Start reviews</Button>
 * <Button variant="secondary" icon="plus">Add a word</Button>
 * <Button variant="quiet" href="/progress">See all</Button>
 */
export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconEnd,
  loading = false,
  full = false,
  href,
  prefetch,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const end = iconEnd === undefined ? (variant === "quiet" ? "chevron-right" : undefined) : (iconEnd ?? undefined);
  const iconSize = variant === "quiet" ? 18 : ICON_SIZE[size];
  const lead = loading ? (
    <Spinner size={iconSize} />
  ) : icon ? (
    <Icon name={icon} size={iconSize} stroke={variant === "secondary" ? 2.4 : 2} className={variant === "secondary" ? "text-accent" : undefined} />
  ) : null;
  const inner = (
    <>
      {lead}
      <span>{children}</span>
      {end && <Icon name={end} size={iconSize} />}
    </>
  );
  const cls = buttonClass({ variant, size, full, className });
  if (href !== undefined) {
    return (
      <Link
        href={href}
        prefetch={prefetch}
        className={cls}
        aria-busy={loading || undefined}
        aria-disabled={rest.disabled || undefined}
        aria-label={rest["aria-label"]}
        aria-current={rest["aria-current"]}
        onClick={rest.onClick as unknown as MouseEventHandler<HTMLAnchorElement> | undefined}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} className={cls} aria-busy={loading || undefined} {...rest}>
      {inner}
    </button>
  );
}
