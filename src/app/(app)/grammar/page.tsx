import type { Metadata } from "next";

import { GrammarScreen, levelParam } from "@/components/learn/grammar-screen";
import { requireSignedIn } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Grammar" };

/** The grammar list; each lesson opens on its own page. */
export default async function GrammarPage({ searchParams }: PageProps<"/grammar">) {
  await requireSignedIn();
  return <GrammarScreen level={levelParam((await searchParams).level)} />;
}
