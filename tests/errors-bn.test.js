import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bnMessage, displayMessage, GENERIC } from "../js/errors-bn.js";
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../apps-script");

test("every static validation/conflict message in the Apps Script code has a Bengali translation", () => {
  const msgs = new Set();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".gs"))) {
    const s = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of s.matchAll(/bad_\('([^'+]+)'\)/g)) msgs.add(m[1]);
    for (const m of s.matchAll(/new ApiError\('(?:CONFLICT|VALIDATION_ERROR)', '([^'+]+)'\)/g)) msgs.add(m[1]);
  }
  assert.ok(msgs.size >= 20, "found " + msgs.size);
  const missing = [...msgs].filter((m) => !bnMessage(m));
  assert.deepEqual(missing, []);
});
test("dynamic messages are translated too", () => {
  for (const m of ["actualStartDate must be YYYY-MM-DD", "date is not a valid date", "notes must be text", "notes is too long", "cycleId is invalid", "Period is longer than 14 days",
    "Another period is already recorded within 15 days of this date", "limit must be 1-100", "offset must be 0 or more", "cycleLengthDefault must be 15-90", "lutealLength must be 8-18"]) assert.ok(bnMessage(m), m);
});
test("output is Bengali: unknown English falls back to a generic Bengali line", () => {
  assert.equal(displayMessage("Something we never heard of"), GENERIC);
  assert.ok(/[\u0980-\u09FF]/.test(displayMessage("Start date cannot be in the future")));
  assert.ok(!/[A-Za-z]{4,}/.test(displayMessage("Invalid ageBand")));
});
