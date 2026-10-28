// Code.gs — entry points and explicit action router.
// Every action: (1) gateway signature verified, (2) identity from gateway only, (3) account active,
// (4) payload validated, (5) data scoped to ctx.userId. Unknown actions are rejected.
const SA = ['super_admin', 'support_admin'], CE = ['content_editor', 'super_admin'], SU = ['super_admin'];
// fn(ctx, payload). identity:false = no account needed. admin:true = exempt from maintenance mode. roles = allowed admin roles.
const ACTIONS = {
  'health.check':            { identity: false, fn: function () { return { status: 'ok' }; } },
  'user.me':                 { fn: userMe_ },
  'user.updateProfile':      { fn: userUpdateProfile_ },
  'user.exportData':         { fn: userExportData_ },
  'user.deleteAccount':      { fn: userDeleteAccount_ },
  'consents.list':           { fn: consentsList_ },
  'consents.record':         { fn: consentsRecord_ },
  'cycles.list':             { fn: cyclesList_ },
  'cycles.create':           { fn: cyclesCreate_ },
  'cycles.update':           { fn: cyclesUpdate_ },
  'cycles.delete':           { fn: cyclesDelete_ },
  'dailyLogs.list':          { fn: dailyLogsList_ },
  'dailyLogs.create':        { fn: dailyLogsCreate_ },
  'dailyLogs.update':        { fn: dailyLogsUpdate_ },
  'dailyLogs.delete':        { fn: dailyLogsDelete_ },
  'reminders.list':          { fn: remindersList_ },
  'reminders.update':        { fn: remindersUpdate_ },
  'content.list':            { fn: contentList_ },
  'admin.whoami':            { admin: true, fn: adminWhoami_ },
  'admin.getSummary':        { admin: true, roles: SA, fn: adminGetSummary_ },
  'admin.listUsers':         { admin: true, roles: SA, fn: adminListUsers_ },
  'admin.updateUserStatus':  { admin: true, roles: SA, fn: adminUpdateUserStatus_ },
  'admin.getAuditLogs':      { admin: true, roles: SU, fn: adminGetAuditLogs_ },
  'admin.getSettings':       { admin: true, roles: SU, fn: adminGetSettings_ },
  'admin.updateSettings':    { admin: true, roles: SU, fn: adminUpdateSettings_ },
  'admin.listArticles':      { admin: true, roles: CE, fn: adminListArticles_ },
  'admin.saveArticle':       { admin: true, roles: CE, fn: adminSaveArticle_ },
  'admin.deleteArticle':     { admin: true, roles: CE, fn: adminDeleteArticle_ }
};

function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function doGet() { return json_({ ok: true }); } // no version/config disclosure

function doPost(e) {
  const requestId = Utilities.getUuid();
  try {
    const raw = e && e.postData && e.postData.contents;
    if (!raw || raw.length > CONFIG.MAX_BODY_BYTES) throw new ApiError('BAD_REQUEST', 'Invalid request');
    var body;
    try { body = JSON.parse(raw); } catch (x) { throw new ApiError('BAD_REQUEST', 'Invalid request'); }
    const env = verifyEnvelope_(body);
    if (!Object.prototype.hasOwnProperty.call(ACTIONS, env.action)) throw new ApiError('UNKNOWN_ACTION', 'Unknown action');
    const def = ACTIONS[env.action];
    var ctx = { requestId: requestId };
    if (def.identity !== false) {
      const user = upsertUser_(env.identity);
      const tz = user.timezone || CONFIG.DEFAULT_TZ;
      ctx = { requestId: requestId, userId: user.userId, user: user, tz: tz, today: todayIn_(tz) };
      if (!def.admin && getSetting_('maintenanceMode', 'false') === 'true') throw new ApiError('MAINTENANCE', 'The service is under maintenance');
      if (def.roles) requireRole_(ctx, def.roles); // role comes from the AdminRoles sheet, never from the request
    }
    return json_({ ok: true, data: def.fn(ctx, env.payload === undefined ? {} : env.payload), requestId: requestId });
  } catch (err) {
    if (err instanceof ApiError) return json_({ ok: false, error: { code: err.code, message: err.message }, requestId: requestId });
    console.error(requestId, err && err.name); // no payloads, no health data, no stack to the client
    return json_({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' }, requestId: requestId });
  }
}
