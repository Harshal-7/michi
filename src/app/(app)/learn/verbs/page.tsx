import type { Metadata } from "next";

import { BackLink } from "@/components/ui/back-link";
import { Card } from "@/components/ui/card";
import { Mixed, Ruby } from "@/components/ui/ruby";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { conjugate, FORM_GUIDES, GROUP_NOTES, TE_ENDINGS, type Verb, VERBS } from "@/lib/learn/verbs";
import { ROUTES } from "@/lib/planner/day-plan";

export const metadata: Metadata = { title: "Verb forms" };

const card = "flex flex-col gap-2";
const COLUMNS = [
  { form: "masu", label: "ます" },
  { form: "nai", label: "ない" },
  { form: "te", label: "て" },
  { form: "ta", label: "た" },
] as const;

/**
 * Verb forms (Learn): the three groups, how each N5 form is made, and a table of examples. On a
 * wide screen the groups and form guides flow in two columns, with the full table under them.
 */
export default async function VerbsPage() {
  await requireSignedIn();
  const { furigana } = await getSettings(getDb());
  const teExample = (from: string) => VERBS.find((v) => v.group === 1 && v.ending.endsWith(from) && v.base !== "行");

  return (
    <div data-wide className="flex w-full flex-col gap-4 wide:gap-5">
      <header className="flex flex-col gap-1">
        <BackLink href={ROUTES.learn}>Learn</BackLink>
        <PageHeader title="Verb forms" sub="The three groups and the forms N5 grammar is built on" />
      </header>

      <div className="flex flex-col gap-4 wide:block wide:columns-2 wide:gap-5 wide:[&>section]:mb-5 wide:[&>section]:break-inside-avoid">
      <Card className={card}>
        <h2 className="m-0 text-title font-bold">Three groups</h2>
        {GROUP_NOTES.map((g, i) => (
          <div key={g.group} className={`flex flex-col gap-0.5 ${i ? "border-t-[1.5px] border-line pt-2.5" : ""}`}>
            <h3 className="m-0 text-body font-bold">
              <Mixed text={g.title} />
            </h3>
            <p className="m-0 text-meta leading-ja text-ink2">
              <Mixed text={g.body} furigana={furigana} />
            </p>
          </div>
        ))}
      </Card>

      {FORM_GUIDES.map((guide) => (
        <Card key={guide.form} className={card}>
          <h2 className="m-0 text-title font-bold">
            <Mixed text={guide.title} />
          </h2>
          <p className="m-0 text-body leading-ja">
            <Mixed text={guide.use} furigana={furigana} />
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {guide.rules.map((rule) => (
              <li key={rule} className="text-meta leading-ja text-ink2">
                <Mixed text={rule} furigana={furigana} />
              </li>
            ))}
          </ul>
          {guide.form === "te" && (
            <table className="w-full border-collapse text-body">
              <caption className="sr-only">
                Group 1 <span lang="ja">て</span>-forms by the last sound
              </caption>
              <thead>
                <tr className="text-left text-meta text-ink2">
                  <th className="py-1 font-bold">Ends in</th>
                  <th className="py-1 font-bold">
                    <span lang="ja">て</span>-form
                  </th>
                  <th className="py-1 font-bold">Example</th>
                </tr>
              </thead>
              <tbody>
                {TE_ENDINGS.map((t) => {
                  const v = teExample(t.from[0]);
                  return (
                    <tr key={t.te} className="border-t-[1.5px] border-line">
                      <td lang="ja" className="py-1.5 font-ja font-semibold">
                        {t.from.join(" ")}
                      </td>
                      <td lang="ja" className="py-1.5 font-ja font-semibold text-accent">
                        {t.te}
                      </td>
                      <td className="py-1.5 font-ja font-semibold">{v && <Example v={v} furigana={furigana} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      ))}
      </div>

      <Card className={card}>
        <h2 className="m-0 text-title font-bold">All the forms</h2>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[440px] border-collapse">
            <caption className="sr-only">Fifteen verbs in the dictionary, ます, ない, て and た forms</caption>
            <thead>
              <tr className="text-left text-meta text-ink2">
                <th className="py-1 pr-3 font-bold">Verb</th>
                {COLUMNS.map((c) => (
                  <th key={c.form} lang="ja" className="py-1 pr-3 font-bold">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VERBS.map((v, i) => (
                <tr key={v.base + v.ending} className={i ? "border-t-[1.5px] border-line" : ""}>
                  <th scope="row" className="w-[6.5rem] py-1.5 pr-3 text-left font-normal">
                    <span className="flex flex-col">
                      <Ruby text={conjugate(v, "dictionary")} furigana={furigana} className="font-ja text-lead leading-ja font-semibold" />
                      <span className="text-caption text-ink2">
                        {v.meaning} · group {v.group}
                      </span>
                      {v.note && (
                        <span className="text-caption font-bold text-ink2">
                          <Mixed text={v.note} furigana={furigana} />
                        </span>
                      )}
                    </span>
                  </th>
                  {COLUMNS.map((c) => (
                    <td key={c.form} className="py-1.5 pr-3 align-top">
                      <Ruby text={conjugate(v, c.form)} furigana={furigana} className="font-ja text-lead leading-ja font-semibold" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Example({ v, furigana }: { v: Verb; furigana: boolean }) {
  return (
    <>
      <Ruby text={conjugate(v, "dictionary")} furigana={furigana} /> → <Ruby text={conjugate(v, "te")} furigana={furigana} />
    </>
  );
}
