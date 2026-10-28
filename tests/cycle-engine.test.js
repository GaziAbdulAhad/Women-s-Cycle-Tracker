import test from "node:test";
import assert from "node:assert/strict";
import { predict, analyze, parseDate, addDays, cycleStats, validateStarts } from "../js/cycle-engine.js";

test("28-day cycle", () => {
  assert.deepEqual(predict("2026-10-01", 28), { nextPeriod: "2026-10-29", ovulation: "2026-10-15", fertileStart: "2026-10-10", fertileEnd: "2026-10-16", isEstimate: true });
});
test("30-day cycle", () => {
  const p = predict("2026-10-01", 30);
  assert.equal(p.nextPeriod, "2026-10-31"); assert.equal(p.ovulation, "2026-10-17");
});
test("32-day cycle", () => {
  const p = predict("2026-10-01", 32);
  assert.equal(p.nextPeriod, "2026-11-02"); assert.equal(p.ovulation, "2026-10-19");
});
test("leap year", () => {
  assert.equal(predict("2028-02-10", 28).nextPeriod, "2028-03-09");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2027-02-28", 1), "2027-03-01");
});
test("month and year boundary", () => {
  assert.equal(predict("2026-12-20", 28).nextPeriod, "2027-01-17");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
test("invalid dates rejected", () => {
  for (const s of ["2026-02-30", "2026-13-01", "26-10-01", "", "2026-10-1"]) assert.throws(() => parseDate(s));
});
test("invalid cycle length rejected", () => {
  for (const c of [0, -5, 10, 91, 28.5, "28", NaN]) assert.throws(() => predict("2026-10-01", c), /INVALID_CYCLE_LENGTH/);
});
test("missing history returns null", () => {
  assert.equal(analyze([], { today: "2026-10-27" }), null);
});
test("single entry uses default length and flags insufficient data", () => {
  const a = analyze(["2026-10-01"], { today: "2026-10-27" });
  assert.equal(a.source, "default"); assert.equal(a.cycleLength, 28);
  assert.ok(a.warnings.includes("INSUFFICIENT_DATA")); assert.equal(a.cycleDay, 27);
});
test("history average replaces default", () => {
  const a = analyze(["2026-07-01", "2026-07-31", "2026-08-30", "2026-09-29"], { today: "2026-10-02" });
  assert.equal(a.source, "history"); assert.equal(a.cycleLength, 30); assert.equal(a.phase, "menstrual");
});
test("irregular cycles warned", () => {
  const a = analyze(["2026-05-01", "2026-05-25", "2026-07-05", "2026-07-30"], { today: "2026-08-02" });
  assert.equal(cycleStats(["2026-05-01", "2026-05-25", "2026-07-05", "2026-07-30"]).variability, 17);
  assert.ok(a.warnings.includes("IRREGULAR_CYCLES"));
});
test("late period warned and phase is late", () => {
  const a = analyze(["2026-10-01"], { today: "2026-11-15" });
  assert.ok(a.warnings.includes("PERIOD_LATE")); assert.equal(a.phase, "late");
});
test("predictions are labelled as estimates", () => {
  assert.equal(analyze(["2026-10-01"], { today: "2026-10-05" }).prediction.isEstimate, true);
});
test("bad actual data rejected", () => {
  assert.throws(() => validateStarts(["2026-10-01", "2026-10-01"]), /DUPLICATE_START/);
  assert.throws(() => validateStarts(["2026-10-01", "2026-10-05"]), /STARTS_TOO_CLOSE/);
  assert.throws(() => validateStarts(["2026-12-01"], "2026-10-27"), /FUTURE_DATE/);
});
