import type { HTMLAttributes, ReactNode } from "react";

const PAD = { none: "", sm: "p-3.5", md: "px-5 py-4.5", lg: "p-6" } as const;

type CardProps = {
  /** The element: a <section> by default; <article>, <li> or <div> where that reads better. */
  as?: "section" | "article" | "div" | "li" | "aside";
  /** Inner padding: none (you lay it out), sm 14, md 18/20 (default), lg 24. */
  padding?: keyof typeof PAD;
  className?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">;

/**
 * A card: radius 22, a 1.5px line and the soft card shadow. Never put a card inside a card.
 *
 * @example <Card aria-labelledby="week"><SectionTitle id="week">This week</SectionTitle>…</Card>
 */
export function Card({ as: Tag = "section", padding = "md", className, children, ...rest }: CardProps) {
  return (
    <Tag className={`rounded-card border-[1.5px] border-line bg-surface shadow-card ${PAD[padding]} ${className ?? ""}`} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * The next-step card with a picture on top (Today's farmhouse, the /play hero): the art fills a band
 * 140 tall on the phone and 176 on a laptop, the body sits under it.
 *
 * @example <HeroCard art={<Scene lit={done} />}><h2>Reviews</h2>…<Button size="lg" full>Start reviews</Button></HeroCard>
 */
export function HeroCard({
  art,
  artClassName = "h-35 laptop:h-44",
  className,
  bodyClassName,
  children,
  ...rest
}: {
  /** The picture: usually <Scene />. It is decoration (aria-hidden inside the art). */
  art: ReactNode;
  /** The art band's height (Tailwind classes). */
  artClassName?: string;
  className?: string;
  /** Extra classes for the body under the art. */
  bodyClassName?: string;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "className" | "children">) {
  return (
    <Card padding="none" className={`overflow-hidden ${className ?? ""}`} {...rest}>
      <div className={`overflow-hidden bg-scene-night ${artClassName}`}>{art}</div>
      <div className={`flex flex-col gap-3 px-4.5 pt-3.5 pb-4.5 ${bodyClassName ?? ""}`}>{children}</div>
    </Card>
  );
}
