"use client";
// design-lint: legacy

import Link from "next/link";
import { useState } from "react";

import { Mixed } from "@/components/ui/ruby";
import { Icon } from "@/components/ui/icon";
import type { GrammarStatus, PointRow } from "@/lib/learn/grammar";

const SEARCH = "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M20 20l-4-4";
const LABEL: Record<GrammarStatus, string> = { not_started: "Not started", learning: "Learning", confident: "Confident" };
const PILL: Record<GrammarStatus, string> = {
  confident: "border border-good text-good",
  learning: "bg-accent-soft text-ink",
  not_started: "border border-line text-ink2",
};
const FILTERS: { key: GrammarStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "not_started", label: "Not started" },
  { key: "learning", label: "Learning" },
  { key: "confident", label: "Confident" },
];

/**
 * F_Grammar's list: filter by status, search patterns and meanings, grouped by lesson topic
 * where the level has them. The read-through's next lesson carries a "next" badge.
 */
export function GrammarList({ points, nextId, selectedId }: { points: PointRow[]; nextId: number | null; selectedId: number | null }) {
  const [filter, setFilter] = useState<GrammarStatus | "all">("all");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = points.filter(
    (p) => (filter === "all" || p.status === filter) && (!q || `${p.pattern} ${p.gloss} ${p.searchText}`.toLowerCase().includes(q)),
  );
  const groups: { topic: string | null; points: PointRow[] }[] = [];
  for (const p of shown) {
    const last = groups.at(-1);
    if (last && last.topic === p.topic) last.points.push(p);
    else groups.push({ topic: p.topic, points: [p] });
  }

  return (
    <>
      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`min-h-11 rounded-btn border px-3 text-[13px] font-semibold ${
              filter === f.key ? "border-ink bg-ink text-page" : "border-line bg-transparent text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <label className="flex min-h-11 items-center gap-2 rounded-btn border border-line bg-surface px-3.5 text-ink2">
        <Icon d={SEARCH} size={18} stroke={1.8} />
        <span className="sr-only">Search grammar</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patterns or meanings"
          className="min-w-0 flex-auto border-none bg-transparent text-sm text-ink outline-none"
        />
      </label>
      {groups.length === 0 && (
        <div className="flex items-center gap-2.5 rounded-card border border-dashed border-line p-3">
          <p className="m-0 flex-auto text-[13px] text-ink2">No grammar points match.</p>
        </div>
      )}
      {groups.map((g, gi) => (
        <section key={`${g.topic ?? "all"}-${gi}`} aria-label={g.topic ?? "Grammar points"} className="flex flex-col gap-1.5">
          {g.topic && <h2 className="m-0 mt-1 px-1 text-[13px] font-bold">{g.topic}</h2>}
          <div className="flex flex-col rounded-card bg-surface px-3.5 py-0.5 shadow-card">
            {g.points.map((p, i) => (
              <Link
                key={p.id}
                href={`/grammar/${p.id}`}
                aria-current={p.id === selectedId ? "page" : undefined}
                className={`box-border flex min-h-[52px] items-center gap-2.5 py-[7px] no-underline ${i ? "border-t border-line" : ""} ${
                  p.id === selectedId ? "-mx-3.5 bg-accent-soft px-3.5" : ""
                }`}
              >
                <span className="flex min-w-0 flex-auto flex-col gap-px">
                  <span className="flex items-center gap-2">
                    <span className="font-card text-lg font-semibold">
                      <Mixed text={p.pattern} />
                    </span>
                    {p.id === nextId && (
                      <span className="rounded-btn bg-accent px-2 py-px text-[11px] font-bold text-on-accent">next</span>
                    )}
                  </span>
                  <span className="text-[12.5px] text-ink2">{p.gloss}</span>
                </span>
                <span className={`shrink-0 rounded-btn px-2.5 py-[3px] text-[11.5px] font-bold ${PILL[p.status]}`}>{LABEL[p.status]}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
