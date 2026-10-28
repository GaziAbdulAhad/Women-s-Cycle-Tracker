// CycleService.gs — ACTUAL period records only. Predictions are computed client-side by cycle-engine.js.
function cycleOut_(r) { return { cycleId: r.cycleId, actualStartDate: r.actualStartDate, actualEndDate: r.actualEndDate, notes: r.notes, createdAt: r.createdAt, updatedAt: r.updatedAt }; }

function assertNoNearbyCycle_(mine, start, exceptId) {
  mine.forEach(function (x) {
    if (x.rec.cycleId === exceptId) return;
    if (Math.abs(daysBetween_(x.rec.actualStartDate, start)) < CONFIG.LIMITS.minCycle)
      throw new ApiError('CONFLICT', 'Another period is already recorded within ' + CONFIG.LIMITS.minCycle + ' days of this date');
  });
}

function cyclesList_(ctx, p) {
  const pg = pagination_(requireObject_(p));
  const all = readUserRecords_('Cycles', ctx.userId).map(function (x) { return cycleOut_(x.rec); })
    .sort(function (a, b) { return a.actualStartDate < b.actualStartDate ? 1 : -1; });
  return { items: all.slice(pg.offset, pg.offset + pg.limit), total: all.length, nextOffset: pg.offset + pg.limit < all.length ? pg.offset + pg.limit : null };
}
function cyclesCreate_(ctx, p) {
  const v = validateCyclePayload_(p, ctx.today);
  return withLock_(function () {
    assertNoNearbyCycle_(readUserRecords_('Cycles', ctx.userId), v.actualStartDate, null);
    const now = nowIso_();
    const rec = { cycleId: Utilities.getUuid(), userId: ctx.userId, actualStartDate: v.actualStartDate, actualEndDate: v.actualEndDate, createdAt: now, updatedAt: now, notes: v.notes };
    appendRecord_('Cycles', rec);
    return cycleOut_(rec);
  });
}
function cyclesUpdate_(ctx, p) {
  requireObject_(p);
  const id = validateId_(p.cycleId, 'cycleId'), v = validateCyclePayload_(p, ctx.today);
  return withLock_(function () {
    const mine = readUserRecords_('Cycles', ctx.userId);
    const hit = mine.filter(function (x) { return x.rec.cycleId === id; })[0];
    if (!hit) throw new ApiError('NOT_FOUND', 'Record not found');
    assertNoNearbyCycle_(mine, v.actualStartDate, id);
    const rec = hit.rec;
    rec.actualStartDate = v.actualStartDate; rec.actualEndDate = v.actualEndDate; rec.notes = v.notes; rec.updatedAt = nowIso_();
    writeRecord_('Cycles', hit.row, { cycleId: rec.cycleId, userId: ctx.userId, actualStartDate: rec.actualStartDate, actualEndDate: rec.actualEndDate, createdAt: rec.createdAt, updatedAt: rec.updatedAt, notes: rec.notes });
    return cycleOut_(rec);
  });
}
function cyclesDelete_(ctx, p) {
  requireObject_(p);
  const id = validateId_(p.cycleId, 'cycleId');
  return withLock_(function () { deleteRow_('Cycles', findOwned_('Cycles', ctx.userId, 'cycleId', id).row); return { deleted: true }; });
}
