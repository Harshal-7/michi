import type { ReactNode } from "react";

/**
 * A page's header: a small line above the title (usually the date), the title, and a line
 * under it on screens that have one (F_Work).
 */
export function PageHeader({
  kicker,
  title,
  sub,
  size = "lg",
}: {
  kicker?: ReactNode;
  title: string;
  sub?: ReactNode;
  size?: "lg" | "md";
}) {
  return (
    <header className="flex flex-col gap-0.5">
      {kicker && <p className="m-0 text-[13px] text-ink2">{kicker}</p>}
      <h1 className={`m-0 font-head leading-[1.15] ${size === "lg" ? "text-[30px]" : "text-[28px]"}`}>{title}</h1>
      {sub && <p className="m-0 text-[13px] text-ink2">{sub}</p>}
    </header>
  );
}

/** The empty state from F_Parts: a dashed box with one calm line. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-card border border-dashed border-line p-3">
      <p className="m-0 flex-auto text-[13px] text-ink2">{children}</p>
    </div>
  );
}
