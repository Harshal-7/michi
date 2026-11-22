# Michi 道

A personal Japanese study app, built for one learner on the way from a rusty N5 to JLPT N4 and N3, and
then to Japanese for a developer job. It plans each day's study, runs spaced-repetition reviews (FSRS),
quizzes and mock tests, and logs classes, immersion and speaking practice.

Built with Next.js 16, React 19, TypeScript, Tailwind 4, Drizzle and Neon Postgres, on Vercel
(functions in Singapore, next to the database).

## Run it locally

You need Node 24, pnpm and Docker (OrbStack on the Mac).

```bash
pnpm install
cp .env.example .env.local   # then fill in PASSPHRASE_HASH and SESSION_SECRET (below)
pnpm db:up                   # Postgres 17 in Docker on port 54329
pnpm db:migrate              # create the tables
pnpm db:seed                 # load content/generated/*.json
pnpm dev                     # http://localhost:3000
```

For a local passphrase, run `pnpm auth:hash` and `pnpm auth:secret` and paste the two lines they print
into `.env.local`. Use a different passphrase locally than on the real site.

`pnpm check` runs types, lint, tests and a production build; it passes before a PR is marked ready. The
database tests need `pnpm db:up` first: each test file gets its own throwaway database, copied from a
migrated template.

## Environment

| Variable | What it is | Where it comes from |
|---|---|---|
| `DATABASE_URL` | Postgres, pooled | Vercel: the Neon integration. Locally: `.env.example` |
| `DATABASE_URL_UNPOOLED` | Postgres, direct; used for migrations and the seed when set | The Neon integration |
| `PASSPHRASE_HASH` | The scrypt hash of the sign-in passphrase | `pnpm auth:hash` (asks for it without showing it) |
| `SESSION_SECRET` | Signs the sign-in cookie; changing it signs every device out | `pnpm auth:secret` |
| `TEST_DATABASE_URL` | The Postgres server tests make their databases on | Optional; defaults to the local one |
| `SKIP_DB_DEPLOY` | `1` skips migrations and the seed on a deploy | Optional, an escape hatch |

`pnpm auth:hash --vercel` and `pnpm auth:secret --vercel` send the value straight to the Vercel project
`michi` (Production and Preview, stored as a Secret) instead of printing it. Never put the passphrase
itself anywhere.

## Database

- The schema is `src/db/schema.ts`. After changing it, run `pnpm db:generate` to write a migration in
  `drizzle/`, check the SQL, then `pnpm db:migrate`.
- `pnpm db:seed` loads the starter content through `content/schema.ts`. It is safe to run any time: it
  only updates starter items whose content changed and that you haven't edited, only ever adds cards, and
  never deletes anything.

## Deploying

Vercel runs `pnpm vercel-build`, which is `pnpm db:deploy && next build`:

1. **Migrations** from `drizzle/` are applied (over `DATABASE_URL_UNPOOLED`). If one fails, the build
   fails and the old deployment stays live.
2. **The seed** runs only when `content/generated/` (or the seed code's version) changed since the last
   successful seed, recorded in the `seed_runs` table.
3. `next build`.

Production uses the main Neon branch. With "create a branch for each Preview deployment" switched on in
the Neon integration, each preview gets its own copy of the database, so a PR's migrations and seed never
touch production. Before Neon is connected, the first build skips step 1 and 2 with a warning, and the
sign-in page lists what's missing.

Functions run in `sin1` (Singapore, `vercel.json`), next to the Neon database. The site is
`michi.huhharshal.com`.

## Content and credits

Starter content is generated from open data (KANJIDIC2, JMdict, Tatoeba and the JLPT lists by
Jonathan Waller) into `content/generated/`. Licences and credits are listed in `content/LICENSES.md`.
