// ReminderService.gs — reminder PREFERENCES (in-app banners are computed by the browser) plus an optional
// daily e-mail job. E-mails never contain cycle dates or health details; they only say "you have a reminder".
function reminderDefault_(type) { return { type: type, enabled: false, daysBefore: type === 'period_upcoming' ? 2 : 0, channel: 'in_app' }; }
function remindersList_(ctx) {
  const mine = readUserRecords_('Reminders', ctx.userId).map(function (x) { return x.rec; });
  return { items: CONFIG.REMINDER_TYPES.map(function (t) {
    const r = mine.filter(function (x) { return x.type === t; })[0];
    return r ? { type: t, enabled: String(r.enabled).toLowerCase() === 'true', daysBefore: Number(r.daysBefore), channel: r.channel } : reminderDefault_(t);
  }) };
}
function remindersUpdate_(ctx, p) {
  requireObject_(p);
  if (CONFIG.REMINDER_TYPES.indexOf(p.type) < 0) throw bad_('Invalid type');
  if (typeof p.enabled !== 'boolean') throw bad_('enabled must be true or false');
  if (CONFIG.CHANNELS.indexOf(p.channel) < 0) throw bad_('Invalid channel');
  const days = p.type === 'daily_log' ? 0 : p.daysBefore;
  if (!Number.isInteger(days) || days < 0 || days > 7) throw bad_('daysBefore must be 0-7');
  return withLock_(function () {
    const hit = readUserRecords_('Reminders', ctx.userId).filter(function (x) { return x.rec.type === p.type; })[0];
    const rec = { reminderId: hit ? hit.rec.reminderId : Utilities.getUuid(), userId: ctx.userId, type: p.type, enabled: String(p.enabled), daysBefore: days, channel: p.channel, updatedAt: nowIso_() };
    if (hit) writeRecord_('Reminders', hit.row, rec); else appendRecord_('Reminders', rec);
    return remindersList_(ctx);
  });
}

function addDaysIso_(iso, n) { return new Date(parseIsoDate_(iso, 'date') + n * 86400000).toISOString().slice(0, 10); }
// Same rule as the browser engine: average of the last (up to 6) valid gaps if >= 2, otherwise 28 days.
function nextPeriodFor_(starts) {
  if (!starts.length) return null;
  const s = starts.slice().sort(), gaps = [];
  for (var i = 1; i < s.length; i++) { const g = daysBetween_(s[i - 1], s[i]); if (g >= 15 && g <= 90) gaps.push(g); }
  const r = gaps.slice(-6), L = r.length >= 2 ? Math.round(r.reduce(function (a, b) { return a + b; }, 0) / r.length) : 28;
  return addDaysIso_(s[s.length - 1], L);
}

// Run by a daily time-driven trigger (see installReminderTrigger in Setup.gs). Gmail/MailApp quotas apply;
// triggers are best-effort (Google may delay or skip them), so e-mail reminders are a convenience, not a guarantee.
function sendReminderEmails() {
  const appUrl = PropertiesService.getScriptProperties().getProperty('APP_URL') || '';
  const users = {};
  readAll_('Users').forEach(function (x) { if (x.rec.status === 'active') users[x.rec.userId] = x.rec; });
  const byUser = {};
  readAll_('Reminders').forEach(function (x) { const r = x.rec; if (String(r.enabled).toLowerCase() === 'true' && r.channel === 'email' && users[r.userId]) (byUser[r.userId] = byUser[r.userId] || []).push(r); });
  const ids = Object.keys(byUser); if (!ids.length) return { sent: 0 };
  const starts = {}, logged = {};
  readAll_('Cycles').forEach(function (x) { if (byUser[x.rec.userId]) (starts[x.rec.userId] = starts[x.rec.userId] || []).push(x.rec.actualStartDate); });
  readAll_('DailyLogs').forEach(function (x) { if (byUser[x.rec.userId]) (logged[x.rec.userId] = logged[x.rec.userId] || {})[x.rec.date] = true; });
  var sent = 0;
  ids.forEach(function (uid) {
    try {
      if (MailApp.getRemainingDailyQuota() < 1) return;
      const u = users[uid], today = todayIn_(u.timezone || CONFIG.DEFAULT_TZ); var due = false;
      byUser[uid].forEach(function (r) {
        if (r.type === 'period_upcoming') { const n = nextPeriodFor_(starts[uid] || []); if (n && daysBetween_(today, n) === Number(r.daysBefore)) due = true; }
        else if (r.type === 'daily_log' && !(logged[uid] || {})[today]) due = true;
      });
      if (!due) return;
      MailApp.sendEmail(u.email, 'চক্র: আপনার একটি রিমাইন্ডার আছে', 'অ্যাপ খুলে দেখুন' + (appUrl ? ': ' + appUrl : '.') + '\n\nএই ইমেইল বন্ধ করতে অ্যাপের রিমাইন্ডার পেজে গিয়ে চ্যানেল বদলান।');
      sent++;
    } catch (e) { console.error('reminder failed', e && e.name); }
  });
  return { sent: sent };
}
