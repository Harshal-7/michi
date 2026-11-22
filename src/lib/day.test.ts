import { describe, expect, it } from "vitest";

import {
  addDays,
  dayKind,
  daysBetween,
  formatDayMonth,
  formatLong,
  formatShort,
  isStudyDate,
  isWeekend,
  phaseFor,
  studyDate,
  studyDayBounds,
  weekday,
  weekOf,
} from "./day";

/** An instant written as India time, for readable tests. */
const ist = (local: string) => new Date(`${local}+05:30`);

describe("study date", () => {
  it("starts the day at 4 am India time", () => {
    expect(studyDate(ist("2026-12-03T03:59:59.999"))).toBe("2026-12-02");
    expect(studyDate(ist("2026-12-03T04:00:00"))).toBe("2026-12-03");
  });

  it("keeps the evening's date past midnight", () => {
    expect(studyDate(ist("2026-12-02T23:59:59"))).toBe("2026-12-02");
    expect(studyDate(ist("2026-12-03T00:00:00"))).toBe("2026-12-02");
    expect(studyDate(ist("2026-12-03T01:30:00"))).toBe("2026-12-02");
  });

  it("is 22:30 UTC the evening before", () => {
    expect(studyDate(new Date("2026-12-02T22:29:59Z"))).toBe("2026-12-02");
    expect(studyDate(new Date("2026-12-02T22:30:00Z"))).toBe("2026-12-03");
  });

  it("crosses months and years", () => {
    expect(studyDate(ist("2027-01-01T03:00:00"))).toBe("2026-12-31");
    expect(studyDate(ist("2027-01-01T04:00:00"))).toBe("2027-01-01");
    expect(studyDate(ist("2027-03-01T02:00:00"))).toBe("2027-02-28");
  });

  it("gives the bounds of a study day", () => {
    const { start, end } = studyDayBounds("2026-12-03");
    expect(start.toISOString()).toBe("2026-12-02T22:30:00.000Z");
    expect(end.toISOString()).toBe("2026-12-03T22:30:00.000Z");
    expect(studyDate(start)).toBe("2026-12-03");
    expect(studyDate(new Date(end.getTime() - 1))).toBe("2026-12-03");
    expect(studyDate(end)).toBe("2026-12-04");
  });
});

describe("calendar helpers", () => {
  it("checks dates", () => {
    expect(isStudyDate("2027-02-28")).toBe(true);
    expect(isStudyDate("2027-02-29")).toBe(false);
    expect(isStudyDate("2027-2-1")).toBe(false);
    expect(isStudyDate(20270201)).toBe(false);
    expect(() => addDays("tomorrow", 1)).toThrow(RangeError);
  });

  it("adds days and counts between dates", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
    expect(daysBetween("2026-11-21", "2026-12-31")).toBe(40);
    expect(daysBetween("2026-12-03", "2027-07-04")).toBe(213);
    expect(daysBetween("2026-12-03", "2026-12-03")).toBe(0);
    expect(daysBetween("2026-12-04", "2026-12-03")).toBe(-1);
  });

  it("tells weekdays from weekends", () => {
    expect(weekday("2027-01-02")).toBe(6); // Saturday, the first class
    expect(isWeekend("2027-01-02")).toBe(true);
    expect(isWeekend("2027-01-03")).toBe(true);
    expect(isWeekend("2027-01-04")).toBe(false);
    expect(dayKind("2026-12-03")).toBe("weekday");
    expect(dayKind("2026-12-05")).toBe("weekend");
  });

  it("finds the Monday-to-Sunday week", () => {
    expect(weekOf("2026-12-03")).toEqual({ start: "2026-11-30", end: "2026-12-06" });
    expect(weekOf("2026-11-30")).toEqual({ start: "2026-11-30", end: "2026-12-06" });
    expect(weekOf("2026-12-06")).toEqual({ start: "2026-11-30", end: "2026-12-06" });
    expect(weekOf("2027-01-01")).toEqual({ start: "2026-12-28", end: "2027-01-03" });
  });

  it("formats dates the way the screens show them", () => {
    expect(formatLong("2026-12-03")).toBe("Thursday 3 December");
    expect(formatShort("2026-12-31", "2026-11-21")).toBe("Thu 31 Dec");
    expect(formatShort("2027-01-01", "2026-11-21")).toBe("Fri 1 Jan");
    expect(formatShort("2027-07-04", "2026-11-21")).toBe("Sun 4 Jul 2027");
    expect(formatDayMonth("2027-01-01")).toBe("1 Jan");
  });
});

describe("phases", () => {
  const settings = {
    phases: {
      n5: { start: "2026-11-21" },
      n4: { start: "2027-01-01" },
      n3: { start: "2027-07-05" },
      work: { start: "2027-12-06" },
    },
  };

  it("finds the phase for a date", () => {
    expect(phaseFor("2026-11-20", settings)).toBeNull();
    expect(phaseFor("2026-11-21", settings)).toEqual({ id: "n5", start: "2026-11-21", end: "2026-12-31" });
    expect(phaseFor("2026-12-31", settings)?.id).toBe("n5");
    expect(phaseFor("2027-01-01", settings)?.id).toBe("n4");
    expect(phaseFor("2028-06-01", settings)).toEqual({ id: "work", start: "2027-12-06", end: null });
  });

  it("puts each exam day in the phase it ends", () => {
    expect(phaseFor("2027-07-04", settings)).toEqual({ id: "n4", start: "2027-01-01", end: "2027-07-04" });
    expect(phaseFor("2027-12-05", settings)?.id).toBe("n3");
  });

  it("follows edited dates", () => {
    const moved = { phases: { ...settings.phases, n3: { start: "2027-07-12" } } };
    expect(phaseFor("2027-07-08", moved)?.id).toBe("n4");
  });
});
