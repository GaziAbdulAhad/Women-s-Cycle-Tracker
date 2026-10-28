// cycle-engine.js — pure, deterministic, UTC-safe. All outputs are ESTIMATES.
// Dates are "YYYY-MM-DD" strings; internally UTC midnight timestamps (no DST/timezone drift).

export const LIMITS = { minCycle: 15, maxCycle: 90, maxPeriodDays: 14, irregularRange: 7 };
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

export function predict(lastStart, cycleLength) {
  validateCycleLength(cycleLength);
  const nextPeriod = addDays(lastStart, cycleLength);
  const ovulation = addDays(nextPeriod, -14);
  return { nextPeriod, ovulation, fertileStart: addDays(ovulation, -5), fertileEnd: addDays(ovulation, 1), isEstimate: true };
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
export function analyze(starts, { today, defaultLength = 28, periodDays = 5 } = {}) {
  if (!today) throw new Error("TODAY_REQUIRED");
  const sorted = validateStarts(starts, today);
  if (!sorted.length) return null;
  const lastStart = sorted[sorted.length - 1];
  const stats = cycleStats(sorted);
  const useHistory = stats.count >= 2;
  const cycleLength = validateCycleLength(useHistory ? stats.average : defaultLength);
  const prediction = predict(lastStart, cycleLength);
  const warnings = [];
  if (!useHistory) warnings.push("INSUFFICIENT_DATA");
  if (stats.variability !== null && stats.variability > LIMITS.irregularRange) warnings.push("IRREGULAR_CYCLES");
  const daysLate = daysBetween(prediction.nextPeriod, today);
  if (daysLate > 7) warnings.push("PERIOD_LATE");
  const cycleDay = daysBetween(lastStart, today) + 1;
  return { lastStart, cycleLength, source: useHistory ? "history" : "default", stats, prediction, warnings, cycleDay, phase: phaseFor(cycleDay, prediction, today, periodDays) };
}
