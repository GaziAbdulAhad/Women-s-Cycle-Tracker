// AuthService.gs — account records. userId = verified Google `sub` supplied by the gateway.
function upsertUser_(identity) {
  validateIdentity_(identity);
  return withLock_(function () {
    const found = readUserRecords_('Users', identity.sub)[0];
    if (found) {
      if (found.rec.status !== 'active') throw new ApiError('ACCOUNT_DISABLED', 'This account is not active');
      return found.rec;
    }
    const photo = typeof identity.picture === 'string' && /^https:\/\//.test(identity.picture) ? identity.picture.slice(0, 500) : '';
    const now = nowIso_();
    const rec = {
      userId: identity.sub, email: cleanText_(identity.email, 254, 'email'), displayName: cleanText_(identity.name, 100, 'name'),
      photoURL: photo, status: 'active', createdAt: now, updatedAt: now, timezone: CONFIG.DEFAULT_TZ, language: 'bn'
    };
    appendRecord_('Users', rec);
    appendAudit_(rec.userId, 'user.create', rec.userId, 'ok');
    return rec;
  });
}
function publicUser_(u) {
  return { userId: u.userId, email: u.email, displayName: u.displayName, photoURL: u.photoURL, timezone: u.timezone, language: u.language, createdAt: u.createdAt };
}
function userMe_(ctx) { return publicUser_(ctx.user); }
function userUpdateProfile_(ctx, p) {
  requireObject_(p);
  return withLock_(function () {
    const hit = findOwned_('Users', ctx.userId, 'userId', ctx.userId);
    const rec = hit.rec;
    if (p.timezone !== undefined) rec.timezone = validateTimezone_(p.timezone);
    if (p.language !== undefined) { if (CONFIG.LANGS.indexOf(p.language) < 0) throw bad_('Invalid language'); rec.language = p.language; }
    if (p.displayName !== undefined) rec.displayName = cleanText_(p.displayName, 100, 'displayName');
    rec.updatedAt = nowIso_();
    writeRecord_('Users', hit.row, rec); // status/userId/email are never taken from the client
    return publicUser_(rec);
  });
}
