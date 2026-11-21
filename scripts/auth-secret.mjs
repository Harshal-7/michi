#!/usr/bin/env node
// Makes SESSION_SECRET, the random key that signs the sign-in cookie.
//
//   pnpm auth:secret            prints the line for .env.local or Vercel
//   pnpm auth:secret --vercel   sends it straight to the linked Vercel project (Production
//                               and Preview) instead of printing it
//
// Run it once. Changing SESSION_SECRET later signs every device out.

import { randomBytes } from "node:crypto";

import { sendToVercel } from "./auth-hash.mjs";

const secret = randomBytes(32).toString("base64url");

if (process.argv.includes("--vercel")) {
  try {
    sendToVercel("SESSION_SECRET", secret);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  console.log("SESSION_SECRET is set in Vercel for Production and Preview. Redeploy to use it.");
} else {
  console.log("Add this line to .env.local, and the value to Vercel → Settings → Environment Variables:\n");
  console.log(`SESSION_SECRET=${secret}\n`);
}
