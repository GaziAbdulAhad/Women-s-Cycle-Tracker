import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv } from "../js/csv.js";
import { buildReport, reportCsvRows } from "../js/report-model.js";

test("CSV neutralises spreadsheet formulas and escapes quotes", () => {
  for (const v of ["=1+1", "+cmd", "-2+3", "@SUM(A1)", "\tx", "\rx"]) assert.ok(csvCell(v).startsWith("\"'"), v);
  assert.equal(csvCell('say "hi"'), '"say ""hi"""'); assert.equal(csvCell(null), '""'); assert.equal(csvCell("safe"), '"safe"');
  assert.ok(toCsv([["=HYPERLINK(\"x\")"]]).includes("\"'=HYPERLINK"));
  assert.ok(toCsv([["a"]]).startsWith("\ufeff"));
});
const c = (s, e = "", n = "") => ({ actualStartDate: s, actualEndDate: e, notes: n });
test("report: lengths, durations, variability, symptoms, date range", () => {
  const cycles = [c("2026-01-01", "2026-01-05"), c("2026-01-29", "2026-02-02"), c("2026-03-05", "2026-03-08")];
  const logs = [{ date: "2026-01-10", symptoms: ["cramps", "headache"] }, { date: "2026-02-10", symptoms: ["cramps"] }];
  const r = buildReport(cycles, logs, "2026-01-01", "2026-12-31");
  assert.deepEqual(r.lengths.map((x) => x.days), [28, 35]); assert.equal(r.variability, 7); assert.equal(r.lengthStats.avg, 31.5);
  assert.equal(r.durationStats.min, 4); assert.equal(r.symptoms[0].key, "cramps"); assert.equal(r.symptoms[0].count, 2);
  const narrow = buildReport(cycles, logs, "2026-03-01", "2026-12-31");
  assert.equal(narrow.lengths.length, 1); assert.equal(narrow.symptoms.length, 0);
});
test("report CSV rows protect notes", () => {
  const r = buildReport([c("2026-01-01", "", "=EVIL()")], [], "", "");
  assert.ok(toCsv(reportCsvRows(r)).includes("\"'=EVIL()\""));
});
