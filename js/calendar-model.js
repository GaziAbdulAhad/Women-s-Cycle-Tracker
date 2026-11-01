// Pure calendar model (no DOM): which days are actual period, predicted period, fertile, ovulation.
import { addDays, daysBetween, predict, analyze } from "./cycle-engine.js";

// Personal settings stored in the profile (all optional) -> options for buildModel.
export const modelOptions = (user) => ({ defaultLength: (user && user.cycleLengthDefault) || null, lutealLength: (user && user.lutealLength) || 14, ageBand: (user && user.ageBand) || "" });
export function avgPeriodDays(cycles, fallback = 5) {
  const d = cycles.filter((c) => c.actualEndDate).map((c) => daysBetween(c.actualStartDate, c.actualEndDate) + 1).filter((n) => n >= 1 && n <= 14);
  return d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : fallback;
}
export function buildModel(cycles, today, { futureCycles = 3, defaultLength = null, lutealLength = 14, ageBand = "" } = {}) {
  const periodDays = avgPeriodDays(cycles), starts = cycles.map((c) => c.actualStartDate).sort();
  const actual = cycles.map((c) => {
    let e = c.actualEndDate || addDays(c.actualStartDate, periodDays - 1);
    if (!c.actualEndDate && e > today) e = today; // never mark future days as "actual"
    return [c.actualStartDate, e];
  }).filter(([s, e]) => e >= s);
  let analysis = null, error = null; const future = [];
  try { analysis = analyze(starts, { today, defaultLength, periodDays, lutealLength, ageBand }); } catch (e) { error = e.message; }
  if (analysis) for (let i = 0; i < futureCycles; i++) future.push({ ...predict(addDays(analysis.lastStart, analysis.cycleLength * i), analysis.cycleLength, lutealLength), margin: analysis.margin + i }); // later cycles are less certain
  const done = [...cycles].sort((a, b) => (a.actualStartDate < b.actualStartDate ? -1 : 1)).at(-1);
  const lastPeriodDays = done && done.actualEndDate ? daysBetween(done.actualStartDate, done.actualEndDate) + 1 : null;
  return { periodDays, starts, actual, analysis, future, error, lastPeriodDays, ageBand };
}
export function dayInfo(d, m) {
  const actual = m.actual.some(([s, e]) => d >= s && d <= e);
  let predictedPeriod = false, fertile = false, ovulation = false, possible = false;
  for (const p of m.future) {
    if (d >= p.nextPeriod && d <= addDays(p.nextPeriod, m.periodDays - 1)) predictedPeriod = true;
    if (d === p.ovulation) ovulation = true; else if (d >= p.fertileStart && d <= p.fertileEnd) fertile = true;
    else if (d >= addDays(p.fertileStart, -p.margin) && d <= addDays(p.fertileEnd, p.margin)) possible = true; // wider, less certain range
  }
  return { actual, predictedPeriod: predictedPeriod && !actual, fertile: fertile && !actual, ovulation: ovulation && !actual, possible: possible && !actual && !fertile && !ovulation };
}
