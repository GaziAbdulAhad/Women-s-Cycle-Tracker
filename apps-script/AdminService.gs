// AdminService.gs — role-based admin API. Roles live ONLY in the AdminRoles sheet (edited by the spreadsheet owner),
// never in client data. No admin action can read cycles, daily logs, symptoms or notes: only account-level fields
// and aggregate counts. Every admin read/write is audited.
function roleOf_(userId) {
  const f = readAll_('AdminRoles').filter(function (x) { return x.rec.userId === userId && String(x.rec.active).toLowerCase() === 'true'; })[0];
  return f && CONFIG.ROLES.indexOf(f.rec.role) >= 0 ? f.rec.role : null;
}
function requireRole_(ctx, allowed) {
  const role = roleOf_(ctx.userId);
  if (!role || allowed.indexOf(role) < 0) throw new ApiError('FORBIDDEN', 'You do not have access');
  ctx.role = role;
  return role;
}
function adminWhoami_(ctx) { return { role: roleOf_(ctx.userId) }; }

function adminGetSummary_(ctx) {
  const users = readAll_('Users').map(function (x) { return x.rec; }), now = Date.now(), day = 86400000;
  const within = function (iso, d) { const t = Date.parse(iso); return t && now - t <= d * day; };
  const byDay = {};
  for (var i = 13; i >= 0; i--) byDay[new Date(now - i * day).toISOString().slice(0, 10)] = 0;
  users.forEach(function (u) { const k = String(u.createdAt).slice(0, 10); if (k in byDay) byDay[k]++; });
  const audit = readAll_('AuditLogs').map(function (x) { return x.rec; }).filter(function (a) { return within(a.timestamp, 30); });
  const count = function (n) { return Math.max(0, sheet_(n).getLastRow() - 1); };
  const sum = {
    accounts: { total: users.length, active: users.filter(function (u) { return u.status === 'active'; }).length, suspended: users.filter(function (u) { return u.status === 'suspended'; }).length, new7d: users.filter(function (u) { return within(u.createdAt, 7); }).length, new30d: users.filter(function (u) { return within(u.createdAt, 30); }).length },
    signupsByDay: Object.keys(byDay).map(function (k) { return { date: k, count: byDay[k] }; }),
    usage: { cycleRecords: count('Cycles'), dailyLogs: count('DailyLogs'), reminderRules: count('Reminders') },
    privacyRequests30d: { exports: audit.filter(function (a) { return a.action === 'user.export'; }).length, deletions: audit.filter(function (a) { return a.action === 'user.delete'; }).length },
    health: { serverTime: nowIso_(), maintenanceMode: getSetting_('maintenanceMode', 'false') === 'true', sheetRows: { Users: count('Users'), Cycles: count('Cycles'), DailyLogs: count('DailyLogs'), AuditLogs: count('AuditLogs') } }
  };
  appendAudit_(ctx.userId, 'admin.getSummary', '', 'ok');
  return sum;
}
function adminListUsers_(ctx, p) {
  const pg = pagination_(requireObject_(p));
  const all = readAll_('Users').map(function (x) { return { userId: x.rec.userId, email: x.rec.email, displayName: x.rec.displayName, status: x.rec.status, createdAt: x.rec.createdAt }; })
    .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  appendAudit_(ctx.userId, 'admin.listUsers', '', 'ok');
  return { items: all.slice(pg.offset, pg.offset + pg.limit), total: all.length, nextOffset: pg.offset + pg.limit < all.length ? pg.offset + pg.limit : null };
}
function adminUpdateUserStatus_(ctx, p) {
  requireObject_(p);
  if (typeof p.userId !== 'string' || !/^[0-9]{5,40}$/.test(p.userId)) throw bad_('Invalid userId');
  if (p.status !== 'active' && p.status !== 'suspended') throw bad_('Invalid status');
  if (p.userId === ctx.userId) throw bad_('You cannot change your own status');
  if (roleOf_(p.userId)) throw new ApiError('FORBIDDEN', 'Admin accounts cannot be changed here');
  return withLock_(function () {
    const hit = readUserRecords_('Users', p.userId)[0];
    if (!hit) throw new ApiError('NOT_FOUND', 'Record not found');
    hit.rec.status = p.status; hit.rec.updatedAt = nowIso_();
    writeRecord_('Users', hit.row, hit.rec);
    appendAudit_(ctx.userId, 'admin.updateUserStatus:' + p.status, p.userId, 'ok');
    return { userId: p.userId, status: p.status };
  });
}
function adminGetAuditLogs_(ctx, p) {
  const pg = pagination_(requireObject_(p));
  const all = readAll_('AuditLogs').map(function (x) { return x.rec; }).sort(function (a, b) { return a.timestamp < b.timestamp ? 1 : -1; });
  return { items: all.slice(pg.offset, pg.offset + pg.limit), total: all.length, nextOffset: pg.offset + pg.limit < all.length ? pg.offset + pg.limit : null };
}
function adminGetSettings_() { return { maintenanceMode: getSetting_('maintenanceMode', 'false') === 'true' }; }
function adminUpdateSettings_(ctx, p) {
  requireObject_(p);
  if (typeof p.maintenanceMode !== 'boolean') throw bad_('maintenanceMode must be true or false');
  return withLock_(function () { upsertSetting_('maintenanceMode', String(p.maintenanceMode)); appendAudit_(ctx.userId, 'admin.updateSettings:maintenance=' + p.maintenanceMode, '', 'ok'); return adminGetSettings_(); });
}

// ---- Health-education CMS (articles live in AppSettings as article:<id>) ----
function articleOut_(x) {
  var v = {}; try { v = JSON.parse(x.rec.settingValue); } catch (e) {}
  return { id: String(x.rec.settingKey).slice(8), title: v.title || '', body: v.body || '', status: v.status || 'draft', updatedAt: x.rec.updatedAt };
}
const articleRows_ = function () { return readAll_('AppSettings').filter(function (x) { return String(x.rec.settingKey).indexOf('article:') === 0; }); };
function contentList_() { return { items: articleRows_().map(articleOut_).filter(function (a) { return a.status === 'published'; }).sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; }) }; }
function adminListArticles_() { return { items: articleRows_().map(articleOut_).sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; }) }; }
function adminSaveArticle_(ctx, p) {
  requireObject_(p);
  const title = cleanText_(p.title, CONFIG.ARTICLE.maxTitle, 'title'), body = cleanText_(p.body, CONFIG.ARTICLE.maxBody, 'body');
  if (!title || !body) throw bad_('title and body are required');
  if (p.status !== 'draft' && p.status !== 'published') throw bad_('Invalid status');
  const id = p.id === undefined ? Utilities.getUuid() : validateId_(p.id, 'id');
  return withLock_(function () {
    const f = articleRows_().filter(function (x) { return x.rec.settingKey === 'article:' + id; })[0];
    if (p.id !== undefined && !f) throw new ApiError('NOT_FOUND', 'Record not found');
    const rec = { settingKey: 'article:' + id, settingValue: JSON.stringify({ title: title, body: body, status: p.status }), updatedAt: nowIso_() };
    if (f) writeRecord_('AppSettings', f.row, rec); else appendRecord_('AppSettings', rec);
    appendAudit_(ctx.userId, 'admin.saveArticle:' + p.status, '', 'ok');
    return articleOut_({ rec: rec });
  });
}
function adminDeleteArticle_(ctx, p) {
  requireObject_(p);
  const id = validateId_(p.id, 'id');
  return withLock_(function () {
    const f = articleRows_().filter(function (x) { return x.rec.settingKey === 'article:' + id; })[0];
    if (!f) throw new ApiError('NOT_FOUND', 'Record not found');
    deleteRows_('AppSettings', [f.row]);
    appendAudit_(ctx.userId, 'admin.deleteArticle', '', 'ok');
    return { deleted: true };
  });
}
