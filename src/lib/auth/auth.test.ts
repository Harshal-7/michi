import { describe, expect, it } from "vitest";

import { hashPassphrase as hashFromScript } from "../../../scripts/auth-hash.mjs";
import { deviceFromUserAgent, safeNext } from "./device";
import { hashPassphrase, verifyPassphrase } from "./password";
import { hashSessionId, newSessionId, signSession, verifySessionToken } from "./token";

describe("passphrase", () => {
  it("verifies the right passphrase and rejects others", async () => {
    const stored = await hashPassphrase("correct horse battery");
    expect(stored.split(":")).toHaveLength(6);
    expect(stored).not.toContain("$");
    expect(await verifyPassphrase("correct horse battery", stored)).toBe(true);
    expect(await verifyPassphrase("correct horse batterY", stored)).toBe(false);
    expect(await verifyPassphrase("", stored)).toBe(false);
  });

  it("accepts hashes made by pnpm auth:hash", async () => {
    const stored = await hashFromScript("made by the script");
    expect(await verifyPassphrase("made by the script", stored)).toBe(true);
  });

  it("treats full-width and half-width forms alike", async () => {
    const stored = await hashPassphrase("ｍｉｃｈｉ ﾐﾁ 道 2027");
    expect(await verifyPassphrase("michi ミチ 道 2027", stored)).toBe(true);
  });

  it("rejects malformed or weakened hashes", async () => {
    const stored = await hashPassphrase("pw-for-test-only");
    const parts = stored.split(":");
    expect(await verifyPassphrase("pw-for-test-only", undefined)).toBe(false);
    expect(await verifyPassphrase("pw-for-test-only", "plain-text")).toBe(false);
    expect(await verifyPassphrase("pw-for-test-only", ["scrypt", 2, 1, 1, parts[4], parts[5]].join(":"))).toBe(false);
  });
});

describe("session token", () => {
  const secret = "s".repeat(40);

  it("round-trips a signed id", () => {
    const id = newSessionId();
    expect(verifySessionToken(signSession(id, secret), secret)).toBe(id);
  });

  it("rejects tampering, a different secret and junk", () => {
    const id = newSessionId();
    const token = signSession(id, secret);
    const other = newSessionId();
    expect(verifySessionToken(`${other}.${token.split(".")[1]}`, secret)).toBeNull();
    expect(verifySessionToken(`${token.slice(0, -2)}xx`, secret)).toBeNull();
    expect(verifySessionToken(token, "t".repeat(40))).toBeNull();
    expect(verifySessionToken(undefined, secret)).toBeNull();
    expect(verifySessionToken("no-dot", secret)).toBeNull();
    expect(verifySessionToken(`${id}.`, secret)).toBeNull();
  });

  it("keeps a player's cookie and a sign-in cookie apart", () => {
    const id = newSessionId();
    const player = signSession(id, secret, "michi-player");
    expect(verifySessionToken(player, secret, "michi-player")).toBe(id);
    expect(verifySessionToken(player, secret)).toBeNull();
    expect(verifySessionToken(signSession(id, secret), secret, "michi-player")).toBeNull();
  });

  it("stores only a hash of the id", () => {
    const id = newSessionId();
    expect(hashSessionId(id)).not.toContain(id);
    expect(hashSessionId(id)).toBe(hashSessionId(id));
  });
});

describe("sign-in helpers", () => {
  it("only sends you to a page on this site after signing in", () => {
    expect(safeNext("/review")).toBe("/review");
    expect(safeNext("/grammar?level=N4")).toBe("/grammar?level=N4");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("/sign-in")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });

  it("names the device", () => {
    expect(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 15; Pixel 9) Chrome/142 Mobile Safari/537.36")).toBe("phone");
    expect(deviceFromUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/142")).toBe("laptop");
    expect(deviceFromUserAgent(undefined)).toBe("device");
  });
});
