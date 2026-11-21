# Michi 道

A personal Japanese study app, built for one learner on the way from a rusty N5 to JLPT N4 and N3, and
then to Japanese for a developer job. It plans each day's study, runs spaced-repetition reviews (FSRS),
quizzes and mock tests, and logs classes, immersion and speaking practice.

Built with Next.js 16, React 19, TypeScript, Tailwind 4, Drizzle and Neon Postgres, on Vercel.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm check        # types, lint, tests and a production build
```

## Content and credits

Starter content is generated from open data (KANJIDIC2, JMdict, Tatoeba and the JLPT lists by
Jonathan Waller) into `content/generated/`. Licences and credits are listed in `content/LICENSES.md`.
