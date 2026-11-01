import test from "node:test";
import assert from "node:assert/strict";
import { buildModel, dayInfo, avgPeriodDays, modelOptions } from "../js/calendar-model.js";

const c = (s, e = "") => ({ actualStartDate: s, actualEndDate: e });
test("no cycles -> no analysis", () => assert.equal(buildModel([], "2026-10-27").analysis, null));
test("actual vs predicted are separate", () => {
  const m = buildModel([c("2026-10-01", "2026-10-05")], "2026-10-10");
  assert.deepEqual(dayInfo("2026-10-03", m), { actual: true, predictedPeriod: false, fertile: false, ovulation: false, possible: false });
  assert.equal(dayInfo("2026-10-29", m).predictedPeriod, true);
  assert.equal(dayInfo("2026-10-15", m).ovulation, true);
  assert.equal(dayInfo("2026-10-12", m).fertile, true);
  assert.equal(dayInfo("2026-10-29", m).actual, false);
});
test("period without end date never marks future days as actual", () => {
  const m = buildModel([c("2026-10-26")], "2026-10-27");
  assert.equal(dayInfo("2026-10-27", m).actual, true);
  assert.equal(dayInfo("2026-10-28", m).actual, false);
});
test("projects 3 future cycles from the history average", () => {
  const m = buildModel([c("2026-07-01"), c("2026-07-31"), c("2026-08-30")], "2026-09-05");
  assert.equal(m.analysis.cycleLength, 30); assert.equal(m.future.length, 3);
  assert.equal(m.future[0].nextPeriod, "2026-09-29"); assert.equal(m.future[1].nextPeriod, "2026-10-29");
});
test("average period length from recorded durations", () => {
  assert.equal(avgPeriodDays([c("2026-01-01", "2026-01-04"), c("2026-02-01", "2026-02-06")]), 5);
  assert.equal(avgPeriodDays([c("2026-01-01")]), 5);
});
test("inconsistent data is reported, not thrown", () => {
  const m = buildModel([c("2026-12-01")], "2026-10-27");
  assert.equal(m.analysis, null); assert.equal(m.error, "FUTURE_DATE");
});

test("possible (wider) fertile range is shown but never over core days; ovulation day not duplicated", () => {
  const m = buildModel([c("2026-10-01", "2026-10-05")], "2026-10-10"); // default: margin 5, fertile 10-10..10-15
  assert.equal(dayInfo("2026-10-12", m).possible, false); assert.equal(dayInfo("2026-10-12", m).fertile, true);
  assert.equal(dayInfo("2026-10-18", m).possible, true); assert.equal(dayInfo("2026-10-18", m).fertile, false);
  assert.equal(dayInfo("2026-10-21", m).possible, false);
  assert.equal(dayInfo("2026-10-03", m).possible, false);
});
test("profile settings feed the model (own cycle length, luteal length)", () => {
  const opt = modelOptions({ cycleLengthDefault: 32, lutealLength: 12, ageBand: "26_41" });
  assert.deepEqual(opt, { defaultLength: 32, lutealLength: 12, ageBand: "26_41" });
  assert.deepEqual(modelOptions({ cycleLengthDefault: null }), { defaultLength: null, lutealLength: 14, ageBand: "" });
  const m = buildModel([c("2026-10-01", "2026-10-05")], "2026-10-10", opt);
  assert.equal(m.analysis.cycleLength, 32); assert.equal(m.analysis.source, "setting"); assert.equal(m.future[0].ovulation, "2026-10-21");
});
test("last period length is reported for the long-period note", () => {
  assert.equal(buildModel([c("2026-10-01", "2026-10-09")], "2026-10-12").lastPeriodDays, 9);
  assert.equal(buildModel([c("2026-10-01")], "2026-10-12").lastPeriodDays, null);
});
test("inconsistent personal settings are reported, not thrown", () => {
  const m = buildModel([c("2026-10-01")], "2026-10-05", { defaultLength: 20, lutealLength: 16 });
  assert.equal(m.analysis, null); assert.equal(m.error, "INCONSISTENT_LENGTHS");
});
