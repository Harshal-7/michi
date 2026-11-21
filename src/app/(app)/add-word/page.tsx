import type { Metadata } from "next";

import { Stub } from "@/components/ui/stub";
import { requireSignedIn } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add a word" };

export default async function AddWordPage() {
  await requireSignedIn();
  return (
    <Stub
      title="Add a word"
      empty="Quick add, with the reading and meaning filled in from the dictionary, arrives in round 3."
    />
  );
}
