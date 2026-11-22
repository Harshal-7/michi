import { redirect } from "next/navigation";

import { requireSignedIn } from "@/lib/auth/session";
import { pointsFor } from "@/lib/learn/cached";
import { nextUnread, READ_THROUGH_LEVEL } from "@/lib/learn/grammar";

/** Today's "Read N5 grammar" task starts here: the first lesson not read yet, or the list. */
export default async function NextLessonPage() {
  await requireSignedIn();
  const next = nextUnread(await pointsFor(READ_THROUGH_LEVEL));
  redirect(next ? `/grammar/${next.id}` : "/grammar");
}
