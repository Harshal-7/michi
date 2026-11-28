"use client";

import { useTransition } from "react";

import { resolveFlag } from "@/app/(app)/settings/flags/actions";
import { Button } from "@/components/ui/button";

export function ResolveFlag({ id, resolved }: { id: number; resolved: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="sm" disabled={pending} loading={pending} onClick={() => start(() => resolveFlag(id, !resolved))}>
      {resolved ? "Reopen" : "Resolve"}
    </Button>
  );
}
