/**
 * A loading placeholder in the shape of what's coming: a surface2 block that breathes softly (still
 * under reduced motion). Build the page's shape from these, then let the content fade in.
 *
 * @example <Skeleton shape="line" className="w-2/5" /> <Skeleton shape="block" className="h-36" />
 */
export function Skeleton({ shape = "line", className }: { /** line 12 tall pill · block a card-radius box · circle. */ shape?: "line" | "block" | "circle"; className?: string }) {
  const base = { line: "h-3 rounded-full", block: "rounded-card", circle: "rounded-full" }[shape];
  return <span aria-hidden="true" className={`block animate-pulse-soft bg-surface2 ${base} ${className ?? ""}`} />;
}

/**
 * A few skeleton lines with a "Loading" label for screen readers, while a session starts.
 *
 * @example <SkeletonText lines={3} label="Getting today’s plan…" />
 */
export function SkeletonText({ lines = 3, label = "Loading", className }: { lines?: number; /** Read out, and shown small under the lines when given. */ label?: string; className?: string }) {
  const widths = ["w-3/5", "w-11/12", "w-4/5", "w-2/3", "w-5/6"];
  return (
    <div role="status" aria-label={label} className={`flex flex-col gap-2.5 ${className ?? ""}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={widths[i % widths.length]} />
      ))}
    </div>
  );
}
