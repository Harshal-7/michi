import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

import { Icon, type IconName } from "./icon";

const SHAPE = {
  // 48 × 48, radius 14, transparent: close, flag, menu.
  plain: "size-12 rounded-btn bg-transparent text-ink hover:bg-surface2 active:bg-accent-soft",
  // Round accent-soft buttons: the play-the-word button on a card's front (56) and back (52).
  round: "size-14 rounded-full bg-accent-soft text-accent hover:bg-cover-blue hover:text-on-cover",
  "round-sm": "size-13 rounded-full bg-accent-soft text-accent hover:bg-cover-blue hover:text-on-cover",
} as const;

/**
 * An icon-only button. It always needs `label` (read out instead of the icon). Flag is an icon button,
 * never a text link.
 *
 * @example <IconButton icon="close" label="Close reviews" href="/" />
 * <IconButton icon="flag" label="Flag this card" onClick={openFlag} />
 */
export function IconButton({
  icon,
  label,
  shape = "plain",
  href,
  className,
  pressed,
  type = "button",
  ...rest
}: {
  /** Which icon. */
  icon: IconName;
  /** What it does, for screen readers and the tooltip ("Close reviews", "Flag this card"). */
  label: string;
  /** plain 48 transparent · round 56 accent-soft · round-sm 52 accent-soft. */
  shape?: keyof typeof SHAPE;
  /** Renders a Next <Link> when it navigates. */
  href?: string;
  /** For toggles: sets aria-pressed and the pressed look. */
  pressed?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "aria-label">) {
  const size = shape === "plain" ? 24 : 26;
  const cls = `inline-grid shrink-0 place-items-center p-0 transition-colors duration-120 disabled:text-ink3 ${SHAPE[shape]} ${
    pressed ? "bg-accent-soft text-accent" : ""
  } ${className ?? ""}`;
  if (href !== undefined) {
    return (
      <Link href={href} aria-label={label} title={label} className={cls}>
        <Icon name={icon} size={size} />
      </Link>
    );
  }
  return (
    <button type={type} aria-label={label} title={label} aria-pressed={pressed} className={cls} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
}
