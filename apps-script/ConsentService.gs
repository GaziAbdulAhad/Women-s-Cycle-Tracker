// ConsentService.gs — records which policy version the user accepted (privacy, terms, medical disclaimer).
function consentOut_(r) { return { consentType: r.consentType, policyVersion: r.policyVersion, acceptedAt: r.acceptedAt, withdrawnAt: r.withdrawnAt }; }
function consentsList_(ctx) { return { items: readUserRecords_('Consents', ctx.userId).map(function (x) { return consentOut_(x.rec); }) }; }
function consentsRecord_(ctx, p) {
  requireObject_(p);
  if (typeof p.policyVersion !== 'string' || !/^[A-Za-z0-9._-]{1,32}$/.test(p.policyVersion)) throw bad_('Invalid policyVersion');
  const types = Array.isArray(p.consentTypes) ? p.consentTypes : [];
  if (!types.length || types.length > CONFIG.CONSENT_TYPES.length || types.some(function (t) { return CONFIG.CONSENT_TYPES.indexOf(t) < 0; })) throw bad_('Invalid consentTypes');
  return withLock_(function () {
    const mine = readUserRecords_('Consents', ctx.userId).map(function (x) { return x.rec; });
    types.forEach(function (t) {
      if (mine.some(function (r) { return r.consentType === t && r.policyVersion === p.policyVersion && !r.withdrawnAt; })) return;
      appendRecord_('Consents', { consentId: Utilities.getUuid(), userId: ctx.userId, consentType: t, policyVersion: p.policyVersion, acceptedAt: nowIso_(), withdrawnAt: '' });
    });
    return consentsList_(ctx);
  });
}
