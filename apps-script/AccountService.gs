// AccountService.gs — data export and account deletion (the user's own data only).
function userExportData_(ctx) {
  const uid = ctx.userId;
  const out = {
    exportedAt: nowIso_(), profile: publicUser_(ctx.user),
    cycles: readUserRecords_('Cycles', uid).map(function (x) { return cycleOut_(x.rec); }),
    dailyLogs: readUserRecords_('DailyLogs', uid).map(function (x) { return logOut_(x.rec); }),
    reminders: remindersList_(ctx).items,
    consents: consentsList_(ctx).items
  };
  appendAudit_(uid, 'user.export', uid, 'ok'); // no content, just the fact
  return out;
}
// Deletes every row belonging to the user, then the account row. Requires an explicit confirmation word.
// The audit log keeps only "user.delete" + the pseudonymous user id (no health data).
function userDeleteAccount_(ctx, p) {
  requireObject_(p);
  if (p.confirm !== 'DELETE') throw bad_('Confirmation required');
  return withLock_(function () {
    ['Cycles', 'DailyLogs', 'Reminders', 'Consents', 'Users'].forEach(function (name) {
      const rows = readUserRecords_(name, ctx.userId).map(function (x) { return x.row; });
      if (rows.length) deleteRows_(name, rows);
    });
    appendAudit_(ctx.userId, 'user.delete', ctx.userId, 'ok');
    return { deleted: true };
  });
}
