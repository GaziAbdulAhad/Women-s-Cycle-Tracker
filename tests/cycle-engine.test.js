import test from "node:test";
import assert from "node:assert/strict";
import { predict, analyze, parseDate, addDays, cycleStats, validateStarts, isIrregular, uncertaintyMargin } from "../js/cycle-engine.js";

test("28-day cycle", () => {
  assert.deepEqual(predict("2026-10-01", 28), { nextPeriod: "2026-10-29", ovulation: "2026-10-15", fertileStart: "2026-10-10", fertileEnd: "2026-10-15", isEstimate: true });
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

test("fertile window is the 6 days ending on the ovulation day (NEJM 1995), not 7", () => {
  const p = predict("2026-10-01", 28);
  assert.equal(p.fertileStart, "2026-10-10"); assert.equal(p.fertileEnd, p.ovulation); assert.equal(p.ovulation, "2026-10-15");
});
test("luteal length setting moves ovulation; invalid / inconsistent lengths rejected", () => {
  const p = predict("2026-10-01", 28, 12);
  assert.equal(p.ovulation, "2026-10-17"); assert.equal(p.fertileStart, "2026-10-12");
  for (const l of [7, 19, 13.5, "14"]) assert.throws(() => predict("2026-10-01", 28, l), /INVALID_LUTEAL_LENGTH/);
  assert.throws(() => predict("2026-10-01", 18, 14), /INCONSISTENT_LENGTHS/);
});
test("cycle length source priority: history > own setting > one measured cycle > 28", () => {
  const today = "2026-10-27";
  assert.equal(analyze(["2026-10-01"], { today }).source, "default");
  const set = analyze(["2026-10-01"], { today, defaultLength: 32 }); assert.equal(set.source, "setting"); assert.equal(set.cycleLength, 32);
  const one = analyze(["2026-08-01", "2026-09-03"], { today }); assert.equal(one.source, "one_cycle"); assert.equal(one.cycleLength, 33);
  const oneSet = analyze(["2026-08-01", "2026-09-03"], { today, defaultLength: 30 }); assert.equal(oneSet.source, "setting");
  const hist = analyze(["2026-07-01", "2026-07-31", "2026-08-30"], { today, defaultLength: 40 }); assert.equal(hist.source, "history"); assert.equal(hist.cycleLength, 30);
  for (const a of [set, one, hist]) assert.ok(a.prediction.isEstimate);
});
test("irregularity thresholds follow FIGO bands; unknown age is conservative; teens never flagged", () => {
  assert.equal(isIrregular(7, "26_41"), false); assert.equal(isIrregular(8, "26_41"), true);
  assert.equal(isIrregular(9, "18_25"), false); assert.equal(isIrregular(10, "18_25"), true);
  assert.equal(isIrregular(9, "42_45"), false); assert.equal(isIrregular(10, "42_45"), true);
  assert.equal(isIrregular(9, ""), false); assert.equal(isIrregular(10, ""), true);
  assert.equal(isIrregular(20, "u18"), false); assert.equal(isIrregular(null, "26_41"), false);
});
test("uncertainty margin: floor 3, grows with own variability up to 7, wider with little data", () => {
  assert.equal(uncertaintyMargin({ variability: 1 }, "history"), 3); assert.equal(uncertaintyMargin({ variability: 10 }, "history"), 5);
  assert.equal(uncertaintyMargin({ variability: 30 }, "history"), 7);
  assert.equal(uncertaintyMargin(null, "default"), 5); assert.equal(uncertaintyMargin(null, "setting"), 4);
});
test("analyze returns ranges around every estimate", () => {
  const a = analyze(["2026-10-01"], { today: "2026-10-05" });
  assert.equal(a.margin, 5); assert.equal(a.ranges.ovulation.from, "2026-10-10"); assert.equal(a.ranges.ovulation.to, "2026-10-20");
  assert.equal(a.ranges.fertile.from, "2026-10-05"); assert.equal(a.ranges.fertile.to, "2026-10-20"); assert.equal(a.ranges.nextPeriod.from, "2026-10-24");
});
test("age band changes the irregular warning only when relevant", () => {
  const starts = ["2026-05-01", "2026-05-29", "2026-07-06", "2026-08-03"]; // gaps 28, 38, 28 -> variability 10
  assert.ok(analyze(starts, { today: "2026-08-10", ageBand: "26_41" }).warnings.includes("IRREGULAR_CYCLES"));
  assert.ok(analyze(starts, { today: "2026-08-10" }).warnings.includes("IRREGULAR_CYCLES"));
  assert.ok(!analyze(starts, { today: "2026-08-10", ageBand: "u18" }).warnings.includes("IRREGULAR_CYCLES"));
});
