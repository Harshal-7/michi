"use client";

import { useTransition } from "react";

import { resolveFlag } from "@/app/(app)/settings/flags/actions";

export function ResolveFlag({ id, resolved }: { id: number; resolved: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => resolveFlag(id, !resolved))}
      className="min-h-11 shrink-0 rounded-btn border border-line bg-surface px-3.5 text-[13px] font-semibold disabled:opacity-60"
    >
      {resolved ? "Reopen" : "Resolve"}
    </button>
  );
}
