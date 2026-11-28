import Link from "next/link";

/** Michi's mark: 道 in Klee One on a cover-blue sticker with a snow rim, then the name. */
export function Logo({ size = "md" }: { /** md for the sidebar, sm for small headers. */ size?: "md" | "sm" }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3 rounded-btn text-title leading-none font-black text-ink no-underline">
      <span
        lang="ja"
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-full bg-cover-blue font-ja text-on-cover shadow-sticker ${size === "md" ? "size-9.5 text-title" : "size-8 text-lead"}`}
      >
        道
      </span>
      <span>Michi</span>
    </Link>
  );
}
