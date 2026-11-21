@AGENTS.md

# Michi 道

A personal Japanese study app: N5 refresh, then JLPT N4 and N3, then Japanese for work. One Next.js app
on Vercel (functions in Singapore) with Neon Postgres through Drizzle, and a passphrase sign-in.

- **The spec** is the approved plan, kept outside this repo on Harshal's machine:
  `~/Developer/docs/learning/japanese/michi-plan.md`. Read the parts your task touches before you start.
- **UI**: read `.claude/skills/michi-design/SKILL.md` first. The design canvas is the source of truth.
- **Content**: `content/schema.ts` is the contract between the content pipeline (`scripts/content/`,
  output in `content/generated/`) and the seed runner. Change both sides in the same PR.
- **Dates**: all study-day maths goes through `src/lib/day.ts` (IST, the day starts at 4 am).
- **Privacy**: this repo is public. Study data lives only in the database. Never commit `.env*`,
  secrets, personal details or exported study data.
- **Workflow**: prefixed branches (`feature/…`, `fix/…`), one PR per session, merge commits.
  `pnpm check` (types, lint, tests, build) passes before a PR is marked ready.
