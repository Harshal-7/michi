import { describe, expect, it } from "vitest";

import { glossOf, nextUnread, pointCounts, type PointRow, statusOf } from "./grammar";

const point = (id: number, over: Partial<PointRow> = {}): PointRow => ({
  id,
  level: "N5",
  pattern: `p${id}`,
  gloss: "",
  searchText: "",
  topic: null,
  status: "not_started",
  read: false,
  ...over,
});

describe("grammar lessons", () => {
  it("finds the read-through's next lesson after the one just read, wrapping round", () => {
    const points = [point(1, { read: true }), point(2), point(3, { read: true }), point(4)];
    expect(nextUnread(points)?.id).toBe(2);
    expect(nextUnread(points, 2)?.id).toBe(4);
    expect(nextUnread(points, 4)?.id).toBe(2);
    expect(nextUnread(points.map((p) => ({ ...p, read: true })))).toBeNull();
    // The lesson just marked never comes back as its own next one.
    expect(nextUnread([point(1), point(2, { read: true })], 1)).toBeNull();
  });

  it("uses the lesson's short meaning, or the explanation's first clause", () => {
    expect(glossOf("please do …", "A polite request.")).toBe("please do …");
    expect(glossOf(undefined, "Too, also; with a negative, (not) either.")).toBe("Too, also");
    expect(glossOf(undefined, "Because / so. Gives a reason.")).toBe("Because / so");
  });

  it("shows the status you set, or Learning once the card has started", () => {
    expect(statusOf("confident", "new")).toBe("confident");
    expect(statusOf(null, "learning")).toBe("learning");
    expect(statusOf(null, "new")).toBe("not_started");
    expect(statusOf(null, null)).toBe("not_started");
  });

  it("counts points by status and read", () => {
    const counts = pointCounts([point(1, { status: "confident", read: true }), point(2, { status: "learning", read: true }), point(3)]);
    expect(counts).toEqual({ total: 3, read: 2, confident: 1, learning: 1, not_started: 1 });
  });
});
