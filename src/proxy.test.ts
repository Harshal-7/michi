import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { SIGN_IN_REQUIRED } from "@/lib/auth/required";
import { proxy } from "@/proxy";

describe("proxy", () => {
  it("lets every request through while sign-in is switched off", () => {
    expect(SIGN_IN_REQUIRED).toBe(false);
    for (const path of ["/", "/review", "/api/reviews"]) {
      const response = proxy(new NextRequest(`https://michi.example/${path.slice(1)}`));
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(response.headers.get("location")).toBeNull();
    }
  });
});
