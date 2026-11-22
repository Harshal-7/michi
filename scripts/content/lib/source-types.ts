/** Shapes of the committed inputs in content/source/. The build checks each file against these. */
import { z } from "zod";

import { Grammar, GrammarLink, Level, Prompt, Resource } from "../../../content/schema";

const nonEmpty = z.string().trim().min(1);

/** Built by `pnpm content:links`: every grammar point on JLPT Sensei's lists, with checked links. */
export const GrammarLinkTable = z.object({
  checkedOn: z.iso.date(),
  points: z.array(
    z.object({
      slug: z.string().regex(/^grammar:n[345]:[a-z0-9-]+$/),
      level: Level,
      /** Position on JLPT Sensei's list. */
      n: z.number().int().positive(),
      /** The Japanese title as listed. */
      title: nonEmpty,
      romaji: nonEmpty,
      links: z.array(GrammarLink),
    }),
  ),
  failed: z.array(z.object({ slug: z.string(), url: z.string(), status: z.number(), note: z.string() })).default([]),
  /**
   * Links confirmed by opening them in a real browser, because the site refused scripted requests
   * (Cloudflare 520) when the checker ran. They are in `points` like any other checked link.
   */
  browserChecked: z.array(z.string()).default([]),
});
export type GrammarLinkTable = z.infer<typeof GrammarLinkTable>;
export type GrammarPointLinks = GrammarLinkTable["points"][number];

/** Built by `pnpm content:links`: the result of opening each resource link. */
export const ResourceLinkTable = z.object({
  links: z.array(
    z.object({ url: z.string(), ok: z.boolean(), status: z.number(), checkedOn: z.iso.date(), note: z.string() }),
  ),
});
export type ResourceLinkTable = z.infer<typeof ResourceLinkTable>;

export const ResourcesSource = z.array(Resource);

/** Hand-written N5 grammar: everything but the level and links, which come from the link table. */
export const GrammarWritten = z.array(Grammar.omit({ level: true, links: true }));
export type GrammarWritten = z.infer<typeof GrammarWritten>;

/**
 * The N5 grammar lessons in learning order: topics in the order they're taught, each with its
 * points' short meaning and how they're made. Every N5 point appears exactly once.
 */
export const GrammarLessons = z.array(
  z.object({
    topic: nonEmpty,
    points: z.array(z.object({ slug: nonEmpty, title: nonEmpty, gloss: nonEmpty, formation: nonEmpty })).min(1),
  }),
);

/** Hand-written pattern and meaning for N4 and N3 points, ahead of their examples. */
export const GrammarMeanings = z.array(z.object({ slug: nonEmpty, pattern: nonEmpty, meaning: nonEmpty }));

export const PromptsSource = z.array(Prompt);

/** Fresh example sentences for words, keyed by word slug. They win over a Tatoeba match. */
export const WordExamples = z.array(z.object({ word: nonEmpty, ja: nonEmpty, en: nonEmpty }));

/** Groups of characters that are easy to confuse. */
export const LookalikeGroups = z.array(z.array(nonEmpty).min(2));
