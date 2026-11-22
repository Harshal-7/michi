import type { Metadata } from "next";

import { Stub } from "@/components/ui/stub";
import { requireSignedIn } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Practice" };

export default async function PracticePage() {
  await requireSignedIn();
  return (
    <Stub
      title="Practice"
      empty="No quizzes yet. The daily quiz and weekly test arrive in round 2, mock tests in round 4."
    />
  );
}
