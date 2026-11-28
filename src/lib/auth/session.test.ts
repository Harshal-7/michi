import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

describe("currentSession with sign-in on", () => {
  it("has no session without a cookie", async () => {
    const { SIGN_IN_REQUIRED } = await import("./required");
    const { currentSession } = await import("./session");
    expect(SIGN_IN_REQUIRED).toBe(true);
    expect(await currentSession()).toBeNull();
  });
});
