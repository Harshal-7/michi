import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SIGN_IN_REQUIRED } from "@/lib/auth/required";
import { newSessionId, SESSION_COOKIE, signSession } from "@/lib/auth/token";
import { proxy } from "@/proxy";

const SECRET = "s".repeat(40);
const passes = (r: Response) => r.headers.get("x-middleware-next") === "1";
const request = (path: string, init: { cookie?: string; method?: string } = {}) =>
  new NextRequest(`https://michi.example${path}`, {
    method: init.method ?? "GET",
    headers: init.cookie ? { cookie: `${SESSION_COOKIE}=${init.cookie}` } : {},
  });

describe("proxy", () => {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = SECRET;
  });
  afterEach(() => {
    process.env.SESSION_SECRET = saved;
  });

  it("is on", () => expect(SIGN_IN_REQUIRED).toBe(true));

  it("sends a signed-out visit to / to the games", () => {
    const r = proxy(request("/"));
    expect(new URL(r.headers.get("location")!).pathname).toBe("/play");
  });

  it("sends other signed-out pages to sign-in, and turns API calls away", async () => {
    const r = proxy(request("/review?deck=2"));
    const to = new URL(r.headers.get("location")!);
    expect(to.pathname).toBe("/sign-in");
    expect(to.searchParams.get("next")).toBe("/review?deck=2");
    const api = proxy(request("/api/reviews"));
    expect(api.status).toBe(401);
    expect(proxy(request("/playlist")).headers.get("location")).toContain("/sign-in");
  });

  it("lets everyone into /play and /api/play", () => {
    for (const path of ["/play", "/play/kana", "/play/leaderboards", "/api/play/me", "/api/play/runs"]) {
      expect(passes(proxy(request(path))), path).toBe(true);
    }
  });

  it("lets a signed cookie through, and not a forged one", () => {
    expect(passes(proxy(request("/review", { cookie: signSession(newSessionId(), SECRET) })))).toBe(true);
    const forged = signSession(newSessionId(), "t".repeat(40));
    expect(passes(proxy(request("/review", { cookie: forged })))).toBe(false);
  });

  it("leaves a Server Action's post to answer for itself", () => {
    expect(passes(proxy(request("/settings", { method: "POST" })))).toBe(true);
  });
});
