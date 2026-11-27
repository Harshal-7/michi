import type { Metadata } from "next";

import { MyPage } from "@/components/play/me";

export const metadata: Metadata = { title: "Your name" };

/** A player's own page: their bests, sign out, and delete their name and scores. */
export default function MePage() {
  return <MyPage />;
}
