import test from "node:test";
import assert from "node:assert/strict";
import { buildModel, dayInfo, avgPeriodDays } from "../js/calendar-model.js";

const c = (s, e = "") => ({ actualStartDate: s, actualEndDate: e });
test("no cycles -> no analysis", () => assert.equal(buildModel([], "2026-10-27").analysis, null));
test("actual vs predicted are separate", () => {
  const m = buildModel([c("2026-10-01", "2026-10-05")], "2026-10-10");
  assert.deepEqual(dayInfo("2026-10-03", m), { actual: true, predictedPeriod: false, fertile: false, ovulation: false });
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
