import { describe, expect, it, vi } from "vitest";

const connection = vi.fn(async () => {});
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection }));

describe("currentSession while sign-in is switched off", () => {
  it("still marks the page as per-request, so it isn't prerendered with build-time data", async () => {
    const { SIGN_IN_REQUIRED } = await import("./required");
    const { currentSession } = await import("./session");
    expect(SIGN_IN_REQUIRED).toBe(false);
    expect(await currentSession()).toMatchObject({ device: "device" });
    expect(connection).toHaveBeenCalled();
  });
});
