/**
 * The database connection: node-postgres (`pg`) through Drizzle. One driver everywhere: Neon
 * on Vercel (its pooled connection string) and Postgres in OrbStack locally and in tests.
 * It speaks plain TCP, so transactions work (round 1's /api/reviews saves a card and its log
 * together).
 */
import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema> & { $client: Pool };
/** A transaction or the database itself: anything queries run on. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

export function createDb(connectionString: string, options: { max?: number } = {}): Db {
  const pool = new Pool({
    connectionString,
    max: options.max ?? 5,
    // Close idle connections quickly; Neon's pooler keeps the server side warm.
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return drizzle(pool, { schema, casing: "snake_case" });
}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL isn't set. See .env.example.");
  return url;
}

// One pool per server instance (and one across dev hot reloads).
const cache = globalThis as { __michiDb?: Db };

/** The app's database. Server code only. */
export function getDb(): Db {
  if (!cache.__michiDb) {
    cache.__michiDb = createDb(databaseUrl());
    // On Vercel, lets idle connections close before the function is suspended.
    attachDatabasePool(cache.__michiDb.$client);
  }
  return cache.__michiDb;
}
