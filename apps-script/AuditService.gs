// AuditService.gs — account/admin events only. Never put health data or tokens here.
// Unauthenticated rejections are NOT written to the sheet (would let anyone fill it); they only reach console logs.
function appendAudit_(actorUserId, action, targetUserId, result) {
  appendRecord_('AuditLogs', { eventId: Utilities.getUuid(), actorUserId: actorUserId, action: action, targetUserId: targetUserId || '', timestamp: nowIso_(), result: result });
}
