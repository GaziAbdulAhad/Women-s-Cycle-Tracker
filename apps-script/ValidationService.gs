// ValidationService.gs — every payload is untrusted. Whitelist fields, never copy the raw object.
function bad_(msg) { return new ApiError('VALIDATION_ERROR', msg); }
function nowIso_() { return new Date().toISOString(); }

function parseIsoDate_(s, field) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw bad_(field + ' must be YYYY-MM-DD');
  const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
  const t = Date.UTC(y, m - 1, d), c = new Date(t);
  if (y < 1990 || c.getUTCFullYear() !== y || c.getUTCMonth() !== m - 1 || c.getUTCDate() !== d) throw bad_(field + ' is not a valid date');
  return t;
}
function daysBetween_(a, b) { return Math.round((parseIsoDate_(b, 'date') - parseIsoDate_(a, 'date')) / 86400000); }

function cleanText_(v, max, field) {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string') throw bad_(field + ' must be text');
  const s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (s.length > max) throw bad_(field + ' is too long');
  return s;
}

function todayIn_(tz) {
  try { return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'); }
  catch (e) { return Utilities.formatDate(new Date(), CONFIG.DEFAULT_TZ, 'yyyy-MM-dd'); }
}
function validateTimezone_(tz) {
  if (typeof tz !== 'string' || tz.length > 64) throw bad_('Invalid timezone');
  try { Utilities.formatDate(new Date(), tz, 'yyyy'); } catch (e) { throw bad_('Invalid timezone'); }
  return tz;
}
function validateId_(id, field) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(id)) throw bad_(field + ' is invalid');
  return id;
}
function requireObject_(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw bad_('Invalid data');
  return p;
}

function validateCyclePayload_(p, today) {
  requireObject_(p);
  const s = p.actualStartDate, e = p.actualEndDate || '';
  const st = parseIsoDate_(s, 'actualStartDate');
  if (s > today) throw bad_('Start date cannot be in the future');
  if (e) {
    const et = parseIsoDate_(e, 'actualEndDate');
    if (et < st) throw bad_('End date cannot be before start date');
    if (e > today) throw bad_('End date cannot be in the future');
    if ((et - st) / 86400000 + 1 > CONFIG.LIMITS.maxPeriodDays) throw bad_('Period is longer than ' + CONFIG.LIMITS.maxPeriodDays + ' days');
  }
  return { actualStartDate: s, actualEndDate: e, notes: cleanText_(p.notes, 500, 'notes') };
}

function validateLogPayload_(p, today) {
  requireObject_(p);
  parseIsoDate_(p.date, 'date');
  if (p.date > today) throw bad_('Date cannot be in the future');
  const flow = p.flowLevel || '', mood = p.mood || '';
  if (CONFIG.FLOW.indexOf(flow) < 0) throw bad_('Invalid flowLevel');
  if (CONFIG.MOOD.indexOf(mood) < 0) throw bad_('Invalid mood');
  var sleep = '';
  if (p.sleepHours !== undefined && p.sleepHours !== null && p.sleepHours !== '') {
    if (typeof p.sleepHours !== 'number' || !isFinite(p.sleepHours) || p.sleepHours < 0 || p.sleepHours > 24) throw bad_('sleepHours must be 0-24');
    sleep = Math.round(p.sleepHours * 10) / 10;
  }
  const raw = p.symptoms === undefined ? [] : p.symptoms;
  if (!Array.isArray(raw) || raw.length > 20) throw bad_('symptoms must be a list of up to 20 items');
  const symptoms = raw.map(function (x) { const t = cleanText_(x, 40, 'symptom'); if (!t) throw bad_('Empty symptom'); return t; });
  return { date: p.date, flowLevel: flow, symptomsJson: JSON.stringify(symptoms), mood: mood, sleepHours: sleep, notes: cleanText_(p.notes, 1000, 'notes') };
}

function pagination_(p) {
  const limit = p.limit === undefined ? 50 : p.limit, offset = p.offset === undefined ? 0 : p.offset;
  if (!Number.isInteger(limit) || limit < 1 || limit > CONFIG.MAX_PAGE) throw bad_('limit must be 1-' + CONFIG.MAX_PAGE);
  if (!Number.isInteger(offset) || offset < 0) throw bad_('offset must be 0 or more');
  return { limit: limit, offset: offset };
}
