// cycle-engine.js — pure, deterministic, UTC-safe. All outputs are ESTIMATES.
// Dates are "YYYY-MM-DD" strings; internally UTC midnight timestamps (no DST/timezone drift).

export const LIMITS = { minCycle: 15, maxCycle: 90, maxPeriodDays: 14, minLuteal: 8, maxLuteal: 18, defaultLuteal: 14, longPeriodDays: 7 };
export const AGE_BANDS = ["", "u18", "18_25", "26_41", "42_45", "46_plus"];
const DAY = 86400000;

export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) throw new Error("INVALID_DATE_FORMAT");
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const t = Date.UTC(y, mo - 1, d);
  const c = new Date(t);
  if (c.getUTCFullYear() !== y || c.getUTCMonth() !== mo - 1 || c.getUTCDate() !== d) throw new Error("INVALID_CALENDAR_DATE");
  return t;
}
export const formatDate = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (s, n) => formatDate(parseDate(s) + n * DAY);
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / DAY);

export function validateCycleLength(c) {
  if (!Number.isInteger(c) || c < LIMITS.minCycle || c > LIMITS.maxCycle) throw new Error("INVALID_CYCLE_LENGTH");
  return c;
}

// Actual period start dates only (never predictions). Throws on bad data.
export function validateStarts(starts, today) {
  const sorted = [...starts].sort();
  sorted.forEach((s) => {
    parseDate(s);
    if (today && parseDate(s) > parseDate(today)) throw new Error("FUTURE_DATE");
  });
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) throw new Error("DUPLICATE_START");
    if (daysBetween(sorted[i - 1], sorted[i]) < LIMITS.minCycle) throw new Error("STARTS_TOO_CLOSE");
  }
  return sorted;
}

// Lengths between consecutive actual starts; gaps outside limits are ignored (missed logging).
export function cycleLengths(starts) {
  const s = [...starts].sort();
  const out = [];
  for (let i = 1; i < s.length; i++) {
    const g = daysBetween(s[i - 1], s[i]);
    if (g >= LIMITS.minCycle && g <= LIMITS.maxCycle) out.push(g);
  }
  return out;
}

export function cycleStats(starts, recent = 6) {
  const l = cycleLengths(starts).slice(-recent);
  if (!l.length) return { count: 0, average: null, min: null, max: null, variability: null };
  const min = Math.min(...l), max = Math.max(...l);
  return { count: l.length, average: Math.round(l.reduce((a, b) => a + b, 0) / l.length), min, max, variability: max - min };
}

export function validateLuteal(l) {
  if (!Number.isInteger(l) || l < LIMITS.minLuteal || l > LIMITS.maxLuteal) throw new Error("INVALID_LUTEAL_LENGTH");
  return l;
}

// FIGO 2018 (Munro et al.): cycles are "regular" if the shortest-to-longest difference is <=7 days (age 26-41) or <=9 days
// (18-25 and 42-45); "irregular" at >=8 / >=10. We do not know the age unless the user tells us, so unknown age uses the
// higher threshold (>=10) to avoid false alarms. Under-18: irregular cycles are common in the first years, so no flag.
export const irregularThreshold = (ageBand) => (ageBand === "26_41" ? 8 : 10);
export function isIrregular(variability, ageBand = "") {
  if (variability === null || variability === undefined || ageBand === "u18") return false;
  return variability >= irregularThreshold(ageBand);
}

// Calendar estimate. Ovulation = next period - luteal length (default 14). Fertile window = the 6 days that END on the
// day of ovulation (Wilcox et al., NEJM 1995: conception occurred only with intercourse in that 6-day span).
export function predict(lastStart, cycleLength, lutealLength = LIMITS.defaultLuteal) {
  validateCycleLength(cycleLength);
  validateLuteal(lutealLength);
  if (cycleLength - lutealLength < 6) throw new Error("INCONSISTENT_LENGTHS");
  const nextPeriod = addDays(lastStart, cycleLength);
  const ovulation = addDays(nextPeriod, -lutealLength);
  return { nextPeriod, ovulation, fertileStart: addDays(ovulation, -5), fertileEnd: ovulation, isEstimate: true };
}

// Uncertainty margin (days) around the estimated dates. HEURISTIC, not a validated model: one study summary reports a
// median within-woman variation of about 3 days (cycle 3.1, luteal 3.0, follicular 5.2), so we use +-3 as the floor and widen
// with the woman's own cycle-length spread (up to 7). With little data we use a wider margin.
export function uncertaintyMargin(stats, source) {
  if (source === "history" && stats && stats.variability !== null && stats.variability !== undefined) return Math.min(7, Math.max(3, Math.ceil(stats.variability / 2)));
  return source === "setting" || source === "one_cycle" ? 4 : 5;
}

export function phaseFor(day, p, today, periodDays) {
  if (day < 1) return null;
  if (day <= periodDays) return "menstrual";
  if (today > p.nextPeriod) return "late";
  if (today < p.fertileStart) return "follicular";
  if (today <= p.fertileEnd) return "ovulation";
  return "luteal";
}

// Main entry point. starts = actual period start dates. Returns null if no history.
// Cycle length priority: 2+ measured gaps (average) > the user's own typical length (setting) > one measured gap > 28.
export function analyze(starts, { today, defaultLength = null, periodDays = 5, lutealLength = LIMITS.defaultLuteal, ageBand = "" } = {}) {
  if (!today) throw new Error("TODAY_REQUIRED");
  const sorted = validateStarts(starts, today);
  if (!sorted.length) return null;
  const lastStart = sorted[sorted.length - 1], stats = cycleStats(sorted);
  let cycleLength, source;
  if (stats.count >= 2) { cycleLength = stats.average; source = "history"; }
  else if (defaultLength) { cycleLength = defaultLength; source = "setting"; }
  else if (stats.count === 1) { cycleLength = cycleLengths(sorted).slice(-1)[0]; source = "one_cycle"; }
  else { cycleLength = 28; source = "default"; }
  validateCycleLength(cycleLength);
  const prediction = predict(lastStart, cycleLength, lutealLength);
  const margin = uncertaintyMargin(stats, source), r = (c) => ({ from: addDays(c, -margin), to: addDays(c, margin) });
  const warnings = [];
  if (source !== "history") warnings.push("INSUFFICIENT_DATA");
  if (isIrregular(stats.variability, ageBand)) warnings.push("IRREGULAR_CYCLES");
  if (daysBetween(prediction.nextPeriod, today) > 7) warnings.push("PERIOD_LATE");
  const cycleDay = daysBetween(lastStart, today) + 1;
  return {
    lastStart, cycleLength, source, lutealLength, ageBand, margin, stats, prediction, warnings, cycleDay,
    ranges: { nextPeriod: r(prediction.nextPeriod), ovulation: r(prediction.ovulation), fertile: { from: addDays(prediction.fertileStart, -margin), to: addDays(prediction.fertileEnd, margin) } },
    phase: phaseFor(cycleDay, prediction, today, periodDays),
  };
}
