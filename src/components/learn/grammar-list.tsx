"use client";

import { useState } from "react";

import { Chip, ChoiceChips } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { List, ListRow } from "@/components/ui/list-row";
import { Mixed } from "@/components/ui/ruby";
import type { GrammarStatus, PointRow } from "@/lib/learn/grammar";

const LABEL: Record<GrammarStatus, string> = { not_started: "Not started", learning: "Learning", confident: "Confident" };
const FILTERS: { value: GrammarStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "not_started", label: "Not started" },
  { value: "learning", label: "Learning" },
  { value: "confident", label: "Confident" },
];

function StatusChip({ status }: { status: GrammarStatus }) {
  if (status === "not_started") return <Chip kind="soon">{LABEL[status]}</Chip>;
  return <Chip cover={status === "confident" ? "mint" : "blue"}>{LABEL[status]}</Chip>;
}

/**
 * The grammar list: filter by status, search patterns and meanings, grouped by lesson topic where
 * the level has them. The read-through's next lesson carries a "next" chip.
 */
export function GrammarList({ points, nextId }: { points: PointRow[]; nextId: number | null }) {
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
      <ChoiceChips label="Filter by status" options={FILTERS} value={filter} onChange={setFilter} />
      <label className="flex h-13 items-center gap-2.5 rounded-btn border-[1.5px] border-line-strong bg-surface px-4 text-ink2 transition-[border-color,box-shadow] duration-120 focus-within:border-accent focus-within:shadow-field">
        <Icon name="search" size={20} />
        <span className="sr-only">Search grammar</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patterns or meanings"
          className="h-full min-w-0 flex-auto border-none bg-transparent text-body text-ink outline-none placeholder:text-ink3"
        />
      </label>
      {groups.length === 0 && <p className="m-0 text-body text-ink2">No grammar points match.</p>}
      {groups.map((g, gi) => (
        <section key={`${g.topic ?? "all"}-${gi}`} aria-label={g.topic ?? "Grammar points"} className="flex flex-col">
          {g.topic && <h2 className="m-0 mt-2 text-lead font-bold">{g.topic}</h2>}
          <List>
            {g.points.map((p) => (
              <ListRow
                key={p.id}
                href={`/grammar/${p.id}`}
                title={
                  <span className="font-ja text-lead font-semibold">
                    <Mixed text={p.pattern} />
                  </span>
                }
                chip={p.id === nextId ? <Chip cover="butter">next</Chip> : undefined}
                meta={p.gloss}
                trailing={<StatusChip status={p.status} />}
              />
            ))}
          </List>
        </section>
      ))}
    </>
  );
}
