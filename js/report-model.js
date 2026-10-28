// Pure report calculations over the user's own records (no DOM).
import { cycleLengths, daysBetween } from "./cycle-engine.js";
import { symLabel } from "./text.js";

export function buildReport(cycles, logs, from, to) {
  const inR = (d) => (!from || d >= from) && (!to || d <= to);
  const asc = [...cycles].sort((a, b) => (a.actualStartDate < b.actualStartDate ? -1 : 1));
  const lengths = [];
  for (let i = 1; i < asc.length; i++) {
    const days = daysBetween(asc[i - 1].actualStartDate, asc[i].actualStartDate);
    if (days >= 15 && days <= 90 && inR(asc[i].actualStartDate)) lengths.push({ date: asc[i].actualStartDate, days });
  }
  const durs = asc.filter((c) => c.actualEndDate && inR(c.actualStartDate)).map((c) => daysBetween(c.actualStartDate, c.actualEndDate) + 1);
  const stat = (a) => (a.length ? { count: a.length, avg: Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10, min: Math.min(...a), max: Math.max(...a) } : null);
  const L = lengths.map((x) => x.days), counts = {};
  const rangeLogs = logs.filter((l) => inR(l.date));
  rangeLogs.forEach((l) => (l.symptoms || []).forEach((k) => { counts[k] = (counts[k] || 0) + 1; }));
  return {
    lengths, lengthStats: stat(L), variability: L.length >= 2 ? Math.max(...L) - Math.min(...L) : null, durationStats: stat(durs),
    symptoms: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ key: k, label: symLabel(k), count: n })),
    cycles: asc.filter((c) => inR(c.actualStartDate)), logs: rangeLogs.sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}
export function reportCsvRows(r) {
  return [["type", "date", "end_date_or_flow", "mood", "sleep_hours", "symptoms", "notes"],
    ...r.cycles.map((c) => ["period", c.actualStartDate, c.actualEndDate, "", "", "", c.notes]),
    ...r.logs.map((l) => ["daily_log", l.date, l.flowLevel, l.mood, l.sleepHours ?? "", (l.symptoms || []).join("; "), l.notes])];
}
