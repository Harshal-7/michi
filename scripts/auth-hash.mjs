#!/usr/bin/env node
// Asks for the passphrase (it isn't shown while you type) and makes PASSPHRASE_HASH, the
// scrambled form the app checks sign-ins against. The passphrase itself is never saved.
//
//   pnpm auth:hash            prints the line for .env.local or Vercel
//   pnpm auth:hash --local    writes it into .env.local (replacing the old line)
//   pnpm auth:hash --vercel   sends it straight to the Vercel project "michi" (Production
//                             and Preview, as a Secret) instead of printing it
//
// Must stay in step with src/lib/auth/password.ts (a unit test checks this).

import { spawnSync } from "node:child_process";
import { randomBytes, scrypt } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const N = 32768;
const R = 8;
const P = 1;
const KEY_LEN = 32;
const MIN_LENGTH = 8;

export function hashPassphrase(passphrase) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(passphrase.normalize("NFKC"), salt, KEY_LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (err, key) => {
      if (err) reject(err);
      else resolve(["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join(":"));
    });
  });
}

function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error("Run this in a terminal, so the passphrase can be typed without showing."));
      return;
    }
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    let value = "";
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      process.stdout.write("\n");
    };
    function onData(chunk) {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          cleanup();
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else value += ch;
      }
    }
    stdin.on("data", onData);
  });
}

/** The Vercel project; VERCEL_PROJECT=<name> for another one. */
const VERCEL_PROJECT = process.env.VERCEL_PROJECT || "michi";

/**
 * Sends a value to the Vercel project through stdin, so it never shows on screen. Stored as a
 * Secret (sensitive) for Production and Preview, replacing any earlier value.
 */
export function sendToVercel(name, value) {
  const result = spawnSync(
    "vercel",
    ["env", "add", name, "--project", VERCEL_PROJECT, "--environment", "production,preview", "--sensitive", "--force", "--yes"],
    { input: value, stdio: ["pipe", "inherit", "inherit"] },
  );
  if (result.error || result.status !== 0) {
    throw new Error(`Couldn't add ${name} to the Vercel project "${VERCEL_PROJECT}". Check that the Vercel CLI is signed in.`);
  }
}

async function main() {
  const toVercel = process.argv.includes("--vercel");
  const first = await askHidden("Passphrase: ");
  if (first.length < MIN_LENGTH) {
    console.error(`Use at least ${MIN_LENGTH} characters. A word and a few numbers works (not a common password).`);
    process.exit(1);
  }
  const again = await askHidden("Type it again: ");
  if (first !== again) {
    console.error("The two entries don't match. Nothing was saved.");
    process.exit(1);
  }
  const hash = await hashPassphrase(first);
  if (process.argv.includes("--local")) {
    const old = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
    const line = `PASSPHRASE_HASH=${hash}`;
    const next = /^PASSPHRASE_HASH=.*$/m.test(old) ? old.replace(/^PASSPHRASE_HASH=.*$/m, line) : `${old}${old && !old.endsWith("\n") ? "\n" : ""}${line}\n`;
    writeFileSync(".env.local", next);
    console.log("\nPASSPHRASE_HASH is set in .env.local. The dev server picks it up on its own; reload the sign-in page.");
  } else if (toVercel) {
    sendToVercel("PASSPHRASE_HASH", hash);
    console.log("\nPASSPHRASE_HASH is set in Vercel for Production and Preview. Redeploy to use it.");
  } else {
    console.log("\nAdd this line to .env.local, and the value to Vercel → Settings → Environment Variables:\n");
    console.log(`PASSPHRASE_HASH=${hash}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
