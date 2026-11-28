import type { Metadata } from "next";

import { Spot } from "@/components/ui/art/spots";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Not found" };

/** RF_States (404): the forked path, plain words, and one clear way home. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-120 flex-col justify-center px-5 py-10">
      <EmptyState
        heading="h1"
        art={<Spot kind="path" size={160} />}
        title={<span className="text-headline">This page isn’t here</span>}
        action={
          <>
            <Button size="lg" href="/" iconEnd="arrow-right" className="w-80 max-w-full">
              Go to Today
            </Button>
            <Button variant="quiet" href="/learn">
              Open Learn
            </Button>
          </>
        }
      >
        The link may be old, or the page moved. The path back is just below.
      </EmptyState>
    </main>
  );
}
