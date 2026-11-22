import { existsSync } from "node:fs";
import path from "node:path";

/** The repo root. The scripts run through pnpm, which starts them there. */
export const ROOT = process.cwd();
if (!existsSync(path.join(ROOT, "content/schema.ts"))) {
  throw new Error(`Run the content scripts from the repo root (got ${ROOT}).`);
}

/** Downloads live here, ignored by git. Never run anything from it. */
export const CACHE = path.join(ROOT, "scripts/content/.cache");
/** Hand-written and checked inputs, committed. */
export const SOURCE = path.join(ROOT, "content/source");
/** Pipeline output, committed. */
export const GENERATED = path.join(ROOT, "content/generated");
