import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

// drizzle-kit is only used to write migrations (`pnpm db:generate`); scripts/db.ts applies them.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
