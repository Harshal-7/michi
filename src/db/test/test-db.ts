/** A fresh, migrated database for one test file. */
import { randomBytes } from "node:crypto";

import { Client } from "pg";
import { inject } from "vitest";

import { createDb, type Db } from "../client";
import { withDatabase } from "./global-setup";

export async function createTestDb(): Promise<{ db: Db; drop: () => Promise<void> }> {
  const info = inject("testDatabase");
  if ("error" in info) throw new Error(info.error);
  const name = `${info.template}_${randomBytes(4).toString("hex")}`;
  const admin = new Client({ connectionString: info.url });
  await admin.connect();
  try {
    await admin.query(`create database "${name}" template "${info.template}"`);
  } finally {
    await admin.end();
  }
  const db = createDb(withDatabase(info.url, name), { max: 3 });
  return {
    db,
    async drop() {
      await db.$client.end();
      const cleanup = new Client({ connectionString: info.url });
      await cleanup.connect();
      await cleanup.query(`drop database if exists "${name}" with (force)`);
      await cleanup.end();
    },
  };
}
