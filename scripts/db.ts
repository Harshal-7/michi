// Database commands. Reads .env.local when it exists (local development); on Vercel the
// environment already has DATABASE_URL.
//
//   pnpm db:migrate   apply new migrations from drizzle/
//   pnpm db:seed      load content/generated/*.json (safe to run any time)
//   pnpm db:deploy    both, skipping the seed when the content hasn't changed (Vercel builds)
import { existsSync } from "node:fs";

import { createDb } from "@/db/client";
import { runMigrations } from "@/db/migrate";
import { loadContent } from "@/db/seed/content";
import { seed, seedIfChanged, type SeedSummary } from "@/db/seed/seed";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function connectionString(command: string): string {
  // Migrations and the seed are long-ish sessions: prefer a direct connection over the pooler.
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (url) return url;
  if (command === "deploy" && process.env.VERCEL) {
    // The first Vercel build runs before Neon is connected. Let it finish: the app then shows
    // what's missing on the sign-in page, and the next deploy migrates and seeds.
    console.warn("⚠ DATABASE_URL isn't set, so migrations and the seed were skipped. Connect Neon in Vercel → Storage.");
    process.exit(0);
  }
  console.error("DATABASE_URL isn't set. Copy .env.example to .env.local and run `pnpm db:up`.");
  process.exit(1);
}

function report(summary: SeedSummary) {
  const rows = Object.entries(summary.files).map(([file, s]) => ({ file, ...s }));
  console.table(rows);
  console.log(
    `Decks added: ${summary.decksAdded} · deck entries added: ${summary.deckItemsAdded} · cards added: ${summary.cardsAdded}`,
  );
}

async function main(command: string | undefined) {
  if (!["migrate", "seed", "deploy"].includes(command ?? "")) {
    console.error("Usage: tsx scripts/db.ts migrate | seed | deploy");
    process.exit(1);
  }
  if (command === "deploy" && process.env.SKIP_DB_DEPLOY === "1") {
    // An escape hatch, e.g. if Preview deployments ever share the production database.
    console.log("SKIP_DB_DEPLOY=1: migrations and the seed were skipped.");
    return;
  }
  const db = createDb(connectionString(command!), { max: 1 });
  try {
    if (command === "migrate" || command === "deploy") {
      await runMigrations(db);
      console.log("Migrations applied.");
    }
    if (command === "seed") {
      const { content } = loadContent();
      report(await seed(db, content));
    }
    if (command === "deploy") {
      const { content, hash } = loadContent();
      const result = await seedIfChanged(db, content, hash);
      if (result.skipped) console.log("Content unchanged since the last seed; skipped.");
      else report(result.summary);
    }
  } finally {
    await db.$client.end();
  }
}

main(process.argv[2]).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
