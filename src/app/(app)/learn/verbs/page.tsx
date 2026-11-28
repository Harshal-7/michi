// design-lint: legacy
import type { Metadata } from "next";

import { BackLink } from "@/components/ui/back-link";
import { Mixed, Ruby } from "@/components/ui/ruby";
import { PageHeader } from "@/components/ui/page-header";
import { getDb } from "@/db/client";
import { getSettings } from "@/db/settings";
import { requireSignedIn } from "@/lib/auth/session";
import { conjugate, FORM_GUIDES, GROUP_NOTES, TE_ENDINGS, type Verb, VERBS } from "@/lib/learn/verbs";
import { ROUTES } from "@/lib/planner/day-plan";

export const metadata: Metadata = { title: "Verb forms" };

const card = "flex flex-col gap-2 rounded-card bg-surface px-3.5 py-3 shadow-card";
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
    <div data-wide className="mx-auto flex w-full max-w-[720px] flex-col gap-3 wide:max-w-none wide:gap-5">
      <BackLink href={ROUTES.learn}>Learn</BackLink>
      <PageHeader title="Verb forms" sub="The three groups and the forms N5 grammar is built on" />

      <div className="flex flex-col gap-3 wide:block wide:columns-2 wide:gap-5 wide:[&>section]:mb-5 wide:[&>section]:break-inside-avoid">
      <section className={card}>
        <h2 className="m-0 text-[13px] font-bold">Three groups</h2>
        {GROUP_NOTES.map((g, i) => (
          <div key={g.group} className={`flex flex-col gap-0.5 ${i ? "border-t border-line pt-2" : ""}`}>
            <h3 className="m-0 text-[14.5px] font-semibold">
              <Mixed text={g.title} />
            </h3>
            <p className="m-0 text-[13.5px] leading-[1.7] text-ink2">
              <Mixed text={g.body} furigana={furigana} />
            </p>
          </div>
        ))}
      </section>

      {FORM_GUIDES.map((guide) => (
        <section key={guide.form} className={card}>
          <h2 className="m-0 text-[15px] font-bold">
            <Mixed text={guide.title} />
          </h2>
          <p className="m-0 text-[13.5px] leading-[1.7]">
            <Mixed text={guide.use} furigana={furigana} />
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {guide.rules.map((rule) => (
              <li key={rule} className="text-[13.5px] leading-[1.8] text-ink2">
                <Mixed text={rule} furigana={furigana} />
              </li>
            ))}
          </ul>
          {guide.form === "te" && (
            <table className="w-full border-collapse text-[13.5px]">
              <caption className="sr-only">Group 1 て-forms by the last sound</caption>
              <thead>
                <tr className="text-left text-xs text-ink2">
                  <th className="py-1 font-semibold">Ends in</th>
                  <th className="py-1 font-semibold">て-form</th>
                  <th className="py-1 font-semibold">Example</th>
                </tr>
              </thead>
              <tbody>
                {TE_ENDINGS.map((t) => {
                  const v = teExample(t.from[0]);
                  return (
                    <tr key={t.te} className="border-t border-line">
                      <td lang="ja" className="py-1.5 text-base">
                        {t.from.join(" ")}
                      </td>
                      <td lang="ja" className="py-1.5 text-base font-semibold">
                        {t.te}
                      </td>
                      <td className="py-1.5 text-base">{v && <Example v={v} furigana={furigana} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}
      </div>

      <section className={card}>
        <h2 className="m-0 text-[13px] font-bold">All the forms</h2>
        <div className="-mx-3.5 overflow-x-auto px-3.5">
          <table className="w-full min-w-[440px] border-collapse">
            <caption className="sr-only">Fifteen verbs in the dictionary, ます, ない, て and た forms</caption>
            <thead>
              <tr className="text-left text-xs text-ink2">
                <th className="py-1 pr-3 font-semibold">Verb</th>
                {COLUMNS.map((c) => (
                  <th key={c.form} lang="ja" className="py-1 pr-3 font-semibold">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VERBS.map((v, i) => (
                <tr key={v.base + v.ending} className={i ? "border-t border-line" : ""}>
                  <th scope="row" className="w-[6.5rem] py-1.5 pr-3 text-left font-normal">
                    <span className="flex flex-col">
                      <Ruby text={conjugate(v, "dictionary")} furigana={furigana} className="font-card text-[17px] leading-[1.8]" />
                      <span className="text-xs text-ink2">
                        {v.meaning} · group {v.group}
                      </span>
                      {v.note && (
                        <span className="text-xs font-semibold text-ink2">
                          <Mixed text={v.note} furigana={furigana} />
                        </span>
                      )}
                    </span>
                  </th>
                  {COLUMNS.map((c) => (
                    <td key={c.form} className="py-1.5 pr-3 align-top">
                      <Ruby text={conjugate(v, c.form)} furigana={furigana} className="font-card text-[17px] leading-[1.8]" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
