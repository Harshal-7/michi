import { join } from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import type { Db } from "./client";

/** drizzle/ at the repo root, written by `pnpm db:generate`. */
export const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

/** Applies any migrations the database hasn't had yet. */
export async function runMigrations(db: Db, migrationsFolder = MIGRATIONS_DIR): Promise<void> {
  await migrate(db, { migrationsFolder });
}
