/**
 * Vitest global setup: makes a migrated template database once per run. Each test file that
 * needs a database copies it (testDb.ts), so files can run in parallel without sharing rows.
 *
 * Needs Postgres: `pnpm db:up` (OrbStack). TEST_DATABASE_URL points at the server; the default
 * is the local one from compose.yaml.
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";

import { Client } from "pg";
import type { TestProject } from "vitest/node";

import { createDb } from "../client";
import { runMigrations } from "../migrate";

const DEFAULT_URL = "postgres://michi:michi@localhost:54329/michi";

declare module "vitest" {
  export interface ProvidedContext {
    /** `template` also prefixes this run's databases, so two runs at once don't collide. */
    testDatabase: { url: string; template: string } | { error: string };
  }
}

export function serverUrl(): string {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  return process.env.TEST_DATABASE_URL || DEFAULT_URL;
}

export function withDatabase(url: string, name: string): string {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

export default async function setup(project: TestProject) {
  const url = serverUrl();
  const admin = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
  try {
    await admin.connect();
  } catch (error) {
    project.provide("testDatabase", {
      error: `Can't reach the test database at ${new URL(url).host} (${(error as Error).message}). Start it with \`pnpm db:up\`.`,
    });
    return;
  }
  const template = `michi_test_${randomBytes(3).toString("hex")}`;
  try {
    await admin.query(`create database "${template}"`);
  } finally {
    await admin.end();
  }
  const db = createDb(withDatabase(url, template), { max: 1 });
  try {
    await runMigrations(db);
  } finally {
    await db.$client.end();
  }
  project.provide("testDatabase", { url, template });

  return async () => {
    const cleanup = new Client({ connectionString: url });
    await cleanup.connect();
    const { rows } = await cleanup.query<{ datname: string }>(
      "select datname from pg_database where datname like $1",
      [`${template}%`],
    );
    for (const { datname } of rows) await cleanup.query(`drop database if exists "${datname}" with (force)`);
    await cleanup.end();
  };
}
