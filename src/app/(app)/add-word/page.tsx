import type { Metadata } from "next";

import { Spot } from "@/components/ui/art/spots";
import { Button } from "@/components/ui/button";
import { Stub } from "@/components/ui/stub";
import { requireSignedIn } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add a word" };

/** Add a word isn't built yet: a calm page that says what's coming. */
export default async function AddWordPage() {
  await requireSignedIn();
  return (
    <Stub
      title="Add a word"
      art={<Spot kind="notebook" />}
      emptyTitle="Quick add is coming"
      empty="Type a word you met in class or in a show, and Michi fills in the reading and meaning from the dictionary and adds it to your reviews. It’s being built next; for now, the starter decks keep your reviews full."
    >
      <div className="flex justify-center">
        <Button variant="quiet" href="/decks">
          See your decks
        </Button>
      </div>
    </Stub>
  );
}
