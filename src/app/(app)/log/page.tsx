import type { Metadata } from "next";

import { Rabbit } from "@/components/ui/art/rabbit";
import { List, ListRow } from "@/components/ui/list-row";
import { Stub } from "@/components/ui/stub";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { formatShort, studyDate } from "@/lib/day";

export const metadata: Metadata = { title: "Log" };

/** The log: minutes work today; the class log and immersion come before the first class. */
export default async function LogPage() {
  await requireSignedIn();
  const { classes } = await getSettings(getDb());
  const first = formatShort(classes.startsOn, studyDate());
  return (
    <Stub
      title="Log"
      art={<Rabbit pose="reading" size={180} />}
      emptyTitle="The class log is on its way"
      empty={`Your first class is ${first}. Logging classes, with what you covered and new words, is coming before then. Minutes from listening, speaking and reading can go in now.`}
    >
      <List aria-label="Log now">
        <ListRow href="/log/minutes" lead={{ icon: "clock", cover: "aqua" }} title="Add minutes" meta="listening, speaking, reading and the rest" />
      </List>
    </Stub>
  );
}
