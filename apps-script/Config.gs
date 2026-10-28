// Config.gs — constants shared by all services. No secrets here (secrets live in Script Properties).
const CONFIG = {
  HEADERS: {
    Users: ['userId','email','displayName','photoURL','status','createdAt','updatedAt','timezone','language'],
    Cycles: ['cycleId','userId','actualStartDate','actualEndDate','createdAt','updatedAt','notes'],
    DailyLogs: ['logId','userId','date','flowLevel','symptomsJson','mood','sleepHours','notes','updatedAt'],
    Reminders: ['reminderId','userId','type','enabled','daysBefore','channel','updatedAt'],
    Consents: ['consentId','userId','consentType','policyVersion','acceptedAt','withdrawnAt'],
    AdminRoles: ['userId','role','active','createdAt','updatedAt'],
    AuditLogs: ['eventId','actorUserId','action','targetUserId','timestamp','result'],
    AppSettings: ['settingKey','settingValue','updatedAt']
  },
  MAX_BODY_BYTES: 40000,
  CLOCK_SKEW_SEC: 300,   // accepted gateway clock difference
  NONCE_TTL_SEC: 600,    // must be > 2 * CLOCK_SKEW_SEC / 2 so a nonce outlives its timestamp window
  MAX_PAGE: 100,
  DEFAULT_TZ: 'Asia/Dhaka',
  LANGS: ['bn', 'en'],
  FLOW: ['', 'none', 'light', 'medium', 'heavy'],
  MOOD: ['', 'good', 'neutral', 'irritable', 'low'],
  LIMITS: { minCycle: 15, maxPeriodDays: 14 },
  REMINDER_TYPES: ['period_upcoming', 'daily_log'],
  CHANNELS: ['in_app', 'email'],
  CONSENT_TYPES: ['privacy_policy', 'terms', 'medical_disclaimer'],
  ROLES: ['super_admin', 'support_admin', 'content_editor'],
  ARTICLE: { maxTitle: 120, maxBody: 6000 }
};

class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function getProp_(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new ApiError('SERVER_MISCONFIGURED', 'Server is not configured');
  return v;
}
