// JournalService.gs — daily logs. One log per user per date.
function logOut_(r) {
  var sym = [];
  try { sym = JSON.parse(r.symptomsJson || '[]'); } catch (e) {}
  return { logId: r.logId, date: r.date, flowLevel: r.flowLevel, symptoms: sym, mood: r.mood, sleepHours: r.sleepHours === '' ? null : Number(r.sleepHours), notes: r.notes, updatedAt: r.updatedAt };
}
function logRec_(id, uid, v) { return { logId: id, userId: uid, date: v.date, flowLevel: v.flowLevel, symptomsJson: v.symptomsJson, mood: v.mood, sleepHours: v.sleepHours, notes: v.notes, updatedAt: nowIso_() }; }

function dailyLogsList_(ctx, p) {
  const pg = pagination_(requireObject_(p));
  const from = p.from ? (parseIsoDate_(p.from, 'from'), p.from) : '', to = p.to ? (parseIsoDate_(p.to, 'to'), p.to) : '';
  const all = readUserRecords_('DailyLogs', ctx.userId).map(function (x) { return x.rec; })
    .filter(function (r) { return (!from || r.date >= from) && (!to || r.date <= to); })
    .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(logOut_);
  return { items: all.slice(pg.offset, pg.offset + pg.limit), total: all.length, nextOffset: pg.offset + pg.limit < all.length ? pg.offset + pg.limit : null };
}
function dailyLogsCreate_(ctx, p) {
  const v = validateLogPayload_(p, ctx.today);
  return withLock_(function () {
    if (readUserRecords_('DailyLogs', ctx.userId).some(function (x) { return x.rec.date === v.date; })) throw new ApiError('CONFLICT', 'A log already exists for this date');
    const rec = logRec_(Utilities.getUuid(), ctx.userId, v);
    appendRecord_('DailyLogs', rec);
    return logOut_(rec);
  });
}
function dailyLogsUpdate_(ctx, p) {
  requireObject_(p);
  const id = validateId_(p.logId, 'logId'), v = validateLogPayload_(p, ctx.today);
  return withLock_(function () {
    const mine = readUserRecords_('DailyLogs', ctx.userId);
    const hit = mine.filter(function (x) { return x.rec.logId === id; })[0];
    if (!hit) throw new ApiError('NOT_FOUND', 'Record not found');
    if (mine.some(function (x) { return x.rec.logId !== id && x.rec.date === v.date; })) throw new ApiError('CONFLICT', 'A log already exists for this date');
    const rec = logRec_(id, ctx.userId, v);
    writeRecord_('DailyLogs', hit.row, rec);
    return logOut_(rec);
  });
}
function dailyLogsDelete_(ctx, p) {
  requireObject_(p);
  const id = validateId_(p.logId, 'logId');
  return withLock_(function () { deleteRow_('DailyLogs', findOwned_('DailyLogs', ctx.userId, 'logId', id).row); return { deleted: true }; });
}
