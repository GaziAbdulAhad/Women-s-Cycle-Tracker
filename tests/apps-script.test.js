// Runs the REAL .gs files in a Node vm with in-memory mocks of Apps Script services.
// This verifies our logic (auth, replay, isolation, validation). It does NOT replace testing on a real deployment.
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../apps-script");
const SECRET = "test-secret-" + "x".repeat(40);
const props = { GATEWAY_SECRET: SECRET, SPREADSHEET_ID: "mock" };
const cache = new Map();
const mail = [];
const sheets = {};

function mkSheet(h) {
  const rows = [h.slice()];
  return {
    rows,
    getLastRow: () => rows.length,
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => rows.slice(r - 1, r - 1 + nr).map((x) => x.slice(c - 1, c - 1 + nc)),
      setValues: (v) => v.forEach((row, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach((x, j) => (rows[r - 1 + i][c - 1 + j] = x)); }),
    }),
    appendRow: (a) => rows.push(a.slice()),
    deleteRow: (n) => rows.splice(n - 1, 1), deleteRows: (n, c) => rows.splice(n - 1, c),
  };
}
const ctx = vm.createContext({
  console,
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    computeHmacSha256Signature: (m, s) => Array.from(crypto.createHmac("sha256", s).update(m).digest()).map((b) => (b > 127 ? b - 256 : b)),
    formatDate: (d, tz, f) => {
      const s = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
      return f === "yyyy" ? s.slice(0, 4) : s;
    },
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null }) },
  CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) || null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: { MimeType: { JSON: "json" }, createTextOutput: (s) => ({ s, setMimeType() { return this; } }) },
  MailApp: { getRemainingDailyQuota: () => 100, sendEmail: (to, subject, body) => mail.push({ to, subject, body }) },
  SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n] }) },
});
const files = ["Config", "SecurityService", "ValidationService", "DatabaseService", "AuditService", "AuthService", "CycleService", "JournalService", "ConsentService", "ReminderService", "AccountService", "AdminService", "Code"];
vm.runInContext(files.map((f) => fs.readFileSync(path.join(dir, f + ".gs"), "utf8")).join("\n"), ctx);
const HEADERS = vm.runInContext("CONFIG.HEADERS", ctx);
Object.keys(HEADERS).forEach((n) => (sheets[n] = mkSheet(HEADERS[n])));
const doPost = vm.runInContext("doPost", ctx);

const A = { sub: "100000000000000001", email: "a@example.com", name: "A" };
const B = { sub: "100000000000000002", email: "b@example.com", name: "B" };
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const nonce = () => crypto.randomBytes(16).toString("hex");
function raw(envObj, secret = SECRET) {
  const envelope = typeof envObj === "string" ? envObj : JSON.stringify(envObj);
  return { envelope, sig: crypto.createHmac("sha256", secret).update(envelope).digest("hex") };
}
const send = (body) => JSON.parse(doPost({ postData: { contents: JSON.stringify(body) } }).s);
function call(identity, action, payload = {}) {
  return send(raw({ v: 1, ts: Math.floor(Date.now() / 1000), nonce: nonce(), action, identity, payload }));
}
const code = (r) => r.error && r.error.code;

test("signed health.check works without identity", () => assert.equal(call(undefined, "health.check").ok, true));
test("unsigned / garbage requests rejected", () => {
  assert.equal(code(send({})), "UNAUTHENTICATED");
  assert.equal(code(send({ envelope: "{}", sig: "00" })), "UNAUTHENTICATED");
  assert.equal(code(JSON.parse(doPost({ postData: { contents: "not json" } }).s)), "BAD_REQUEST");
});
test("wrong secret rejected", () => {
  assert.equal(code(send(raw({ v: 1, ts: Math.floor(Date.now() / 1000), nonce: nonce(), action: "health.check" }, "other"))), "UNAUTHENTICATED");
});
test("tampered envelope rejected", () => {
  const b = raw({ v: 1, ts: Math.floor(Date.now() / 1000), nonce: nonce(), action: "user.me", identity: A });
  b.envelope = b.envelope.replace(A.sub, B.sub);
  assert.equal(code(send(b)), "UNAUTHENTICATED");
});
test("expired timestamp rejected", () => {
  assert.equal(code(send(raw({ v: 1, ts: Math.floor(Date.now() / 1000) - 3600, nonce: nonce(), action: "health.check" }))), "UNAUTHENTICATED");
});
test("replayed request rejected", () => {
  const b = raw({ v: 1, ts: Math.floor(Date.now() / 1000), nonce: nonce(), action: "health.check" });
  assert.equal(send(b).ok, true);
  assert.equal(code(send(b)), "UNAUTHENTICATED");
});
test("missing/invalid identity and unknown actions rejected", () => {
  assert.equal(code(call(undefined, "user.me")), "UNAUTHENTICATED");
  assert.equal(code(call({ sub: "abc" }, "user.me")), "UNAUTHENTICATED");
  for (const a of ["admin.nope", "__proto__", "constructor", "toString"]) assert.equal(code(call(A, a)), "UNKNOWN_ACTION");
});
test("user created once; role/status cannot be set from client", () => {
  assert.equal(call(A, "user.me").data.email, "a@example.com");
  call(A, "user.me");
  assert.equal(sheets.Users.rows.filter((r) => r[0] === A.sub).length, 1);
  const r = call(A, "user.updateProfile", { language: "en", status: "admin", role: "admin", userId: B.sub });
  assert.equal(r.data.language, "en");
  assert.equal(sheets.Users.rows.find((r) => r[0] === A.sub)[4], "active");
  assert.equal(code(call(A, "user.updateProfile", { language: "xx" })), "VALIDATION_ERROR");
  assert.equal(code(call(A, "user.updateProfile", { timezone: "Mars/Base" })), "VALIDATION_ERROR");
});
test("client-supplied userId in payload is ignored", () => {
  const r = call(A, "cycles.create", { actualStartDate: day(-60), userId: B.sub });
  assert.equal(r.ok, true);
  assert.equal(sheets.Cycles.rows.at(-1)[1], A.sub);
  assert.equal(call(B, "cycles.list").data.total, 0);
});
test("cycle validation", () => {
  const bad = (p) => code(call(A, "cycles.create", p));
  assert.equal(bad({ actualStartDate: day(5) }), "VALIDATION_ERROR");
  assert.equal(bad({ actualStartDate: "2026-02-30" }), "VALIDATION_ERROR");
  assert.equal(bad({ actualStartDate: day(-10), actualEndDate: day(-12) }), "VALIDATION_ERROR");
  assert.equal(bad({ actualStartDate: day(-200), actualEndDate: day(-150) }), "VALIDATION_ERROR");
  assert.equal(bad({ actualStartDate: day(-60) }), "CONFLICT");
  assert.equal(bad({ actualStartDate: day(-50) }), "CONFLICT");
  assert.equal(bad({ actualStartDate: day(-100), notes: 5 }), "VALIDATION_ERROR");
  assert.equal(call(A, "cycles.create", { actualStartDate: day(-30), notes: "=HYPERLINK(\"x\")" }).ok, true);
});
test("USER ISOLATION: B cannot read, update or delete A's records", () => {
  const list = call(A, "cycles.list").data;
  assert.equal(list.total, 2);
  const id = list.items[0].cycleId;
  assert.equal(call(B, "cycles.list").data.total, 0);
  assert.equal(code(call(B, "cycles.update", { cycleId: id, actualStartDate: day(-3) })), "NOT_FOUND");
  assert.equal(code(call(B, "cycles.delete", { cycleId: id })), "NOT_FOUND");
  assert.equal(call(A, "cycles.list").data.total, 2);
  assert.equal(call(A, "cycles.update", { cycleId: id, actualStartDate: day(-29), actualEndDate: day(-25) }).data.actualEndDate, day(-25));
  assert.equal(call(A, "cycles.delete", { cycleId: id }).ok, true);
  assert.equal(call(A, "cycles.list").data.total, 1);
});
test("daily logs: CRUD, one per date, validation, isolation", () => {
  const ok = call(A, "dailyLogs.create", { date: day(-1), flowLevel: "light", symptoms: ["cramps"], mood: "good", sleepHours: 7.5, notes: "ok" });
  assert.equal(ok.ok, true); assert.deepEqual(ok.data.symptoms, ["cramps"]);
  assert.equal(code(call(A, "dailyLogs.create", { date: day(-1) })), "CONFLICT");
  for (const p of [{ date: day(-2), sleepHours: 30 }, { date: day(-2), flowLevel: "x" }, { date: day(-2), symptoms: "no" }, { date: day(3) }]) assert.equal(code(call(A, "dailyLogs.create", p)), "VALIDATION_ERROR");
  const id = ok.data.logId;
  assert.equal(code(call(B, "dailyLogs.update", { logId: id, date: day(-1) })), "NOT_FOUND");
  assert.equal(code(call(B, "dailyLogs.delete", { logId: id })), "NOT_FOUND");
  assert.equal(call(B, "dailyLogs.list").data.total, 0);
  assert.equal(call(A, "dailyLogs.update", { logId: id, date: day(-1), mood: "low" }).data.mood, "low");
  assert.equal(call(A, "dailyLogs.delete", { logId: id }).ok, true);
});
test("pagination validated", () => {
  assert.equal(code(call(A, "cycles.list", { limit: 1000 })), "VALIDATION_ERROR");
  assert.equal(code(call(A, "cycles.list", { offset: -1 })), "VALIDATION_ERROR");
});
test("disabled account rejected", () => {
  call(B, "user.me");
  sheets.Users.rows.find((r) => r[0] === B.sub)[4] = "suspended";
  assert.equal(code(call(B, "cycles.list")), "ACCOUNT_DISABLED");
});

// ================= Phase 5: consents, reminders, export/delete, admin, CMS =================
const mk = (n) => ({ sub: "1000000000000001" + n, email: "u" + n + "@example.com", name: "U" + n });
const [D, E, F, G, H] = [4, 5, 6, 7, 8].map(mk); // D,E ordinary; F super_admin; G support_admin; H content_editor
const grant = (u, role, active = "true") => sheets.AdminRoles.rows.push([u.sub, role, active, "", ""]);
const dhaka = (n) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(Date.now() + n * 864e5));
const runFn = (n) => vm.runInContext(n, ctx);
[D, E, F, G, H].forEach((u) => call(u, "user.me"));
grant(F, "super_admin"); grant(G, "support_admin"); grant(H, "content_editor");

test("consents: record, list, idempotent, validated", () => {
  const v = { policyVersion: "2026-10-draft", consentTypes: ["privacy_policy", "terms", "medical_disclaimer"] };
  assert.equal(call(D, "consents.record", v).data.items.length, 3);
  assert.equal(call(D, "consents.record", v).data.items.length, 3);
  assert.equal(call(E, "consents.list").data.items.length, 0);
  for (const p of [{ policyVersion: "x y", consentTypes: ["terms"] }, { policyVersion: "1", consentTypes: [] }, { policyVersion: "1", consentTypes: ["ads"] }]) assert.equal(code(call(D, "consents.record", p)), "VALIDATION_ERROR");
});
test("reminders: defaults, update, validation, isolation", () => {
  assert.equal(call(D, "reminders.list").data.items.length, 2);
  assert.equal(call(D, "reminders.list").data.items[0].enabled, false);
  const r = call(D, "reminders.update", { type: "period_upcoming", enabled: true, daysBefore: 3, channel: "email" }).data.items[0];
  assert.deepEqual([r.enabled, r.daysBefore, r.channel], [true, 3, "email"]);
  call(D, "reminders.update", { type: "period_upcoming", enabled: false, daysBefore: 1, channel: "in_app" });
  assert.equal(sheets.Reminders.rows.filter((x) => x[1] === D.sub).length, 1);
  assert.equal(call(E, "reminders.list").data.items[0].enabled, false);
  for (const p of [{ type: "x", enabled: true, daysBefore: 1, channel: "email" }, { type: "daily_log", enabled: "yes", daysBefore: 0, channel: "email" }, { type: "daily_log", enabled: true, daysBefore: 0, channel: "sms" }, { type: "period_upcoming", enabled: true, daysBefore: 9, channel: "email" }]) assert.equal(code(call(D, "reminders.update", p)), "VALIDATION_ERROR");
});
test("reminder e-mails: only when due, generic text, only for e-mail channel", () => {
  call(E, "cycles.create", { actualStartDate: dhaka(-26) }); // default 28-day cycle -> next period in 2 days
  call(E, "reminders.update", { type: "period_upcoming", enabled: true, daysBefore: 2, channel: "email" });
  mail.length = 0; assert.equal(runFn("sendReminderEmails")().sent, 1);
  assert.equal(mail[0].to, E.email); assert.ok(!/\d{4}-\d{2}-\d{2}|মাসিক/.test(mail[0].subject + mail[0].body), "no cycle details in e-mail");
  call(E, "reminders.update", { type: "period_upcoming", enabled: true, daysBefore: 5, channel: "email" });
  mail.length = 0; assert.equal(runFn("sendReminderEmails")().sent, 0);
  call(E, "reminders.update", { type: "period_upcoming", enabled: true, daysBefore: 2, channel: "in_app" });
  assert.equal(runFn("sendReminderEmails")().sent, 0);
  call(E, "reminders.update", { type: "daily_log", enabled: true, daysBefore: 0, channel: "email" });
  assert.equal(runFn("sendReminderEmails")().sent, 1);
  call(E, "dailyLogs.create", { date: dhaka(0) });
  assert.equal(runFn("sendReminderEmails")().sent, 0);
});
test("admin endpoints: ordinary users are FORBIDDEN, whoami shows null", () => {
  assert.equal(call(D, "admin.whoami").data.role, null);
  for (const a of ["admin.getSummary", "admin.listUsers", "admin.getAuditLogs", "admin.getSettings", "admin.listArticles"]) assert.equal(code(call(D, a)), "FORBIDDEN", a);
  for (const [a, p] of [["admin.updateUserStatus", { userId: E.sub, status: "suspended" }], ["admin.updateSettings", { maintenanceMode: true }], ["admin.saveArticle", { title: "t", body: "b", status: "published" }]]) assert.equal(code(call(D, a, p)), "FORBIDDEN", a);
  assert.equal(call(E, "user.updateProfile", { role: "super_admin" }).ok, true);
  assert.equal(call(E, "admin.whoami").data.role, null);
});
test("admin role matrix", () => {
  assert.equal(call(F, "admin.whoami").data.role, "super_admin");
  assert.equal(call(G, "admin.getSummary").ok, true); assert.equal(call(G, "admin.listUsers").ok, true);
  for (const a of ["admin.getAuditLogs", "admin.getSettings", "admin.listArticles"]) assert.equal(code(call(G, a)), "FORBIDDEN", a);
  assert.equal(call(H, "admin.listArticles").ok, true);
  for (const a of ["admin.getSummary", "admin.listUsers", "admin.getAuditLogs"]) assert.equal(code(call(H, a)), "FORBIDDEN", a);
  for (const a of ["admin.getSummary", "admin.listUsers", "admin.getAuditLogs", "admin.getSettings", "admin.listArticles"]) assert.equal(call(F, a).ok, true, a);
});
test("inactive admin role grants nothing", () => {
  const X = mk(9); call(X, "user.me"); grant(X, "super_admin", "false");
  assert.equal(call(X, "admin.whoami").data.role, null); assert.equal(code(call(X, "admin.getSummary")), "FORBIDDEN");
});
test("admin data is account-level only: no health data anywhere", () => {
  call(D, "cycles.create", { actualStartDate: dhaka(-40), notes: "SECRET-NOTE" });
  call(D, "dailyLogs.create", { date: dhaka(-1), symptoms: ["cramps"], notes: "SECRET-LOG" });
  const out = JSON.stringify([call(F, "admin.getSummary").data, call(F, "admin.listUsers", { limit: 100 }).data, call(F, "admin.getAuditLogs", { limit: 100 }).data, call(G, "admin.listUsers", { limit: 100 }).data]);
  assert.ok(!/SECRET|cramps|actualStartDate|symptom/.test(out));
  assert.deepEqual(Object.keys(call(F, "admin.listUsers").data.items[0]).sort(), ["createdAt", "displayName", "email", "status", "userId"]);
  assert.ok(call(F, "admin.getSummary").data.usage.cycleRecords >= 1);
});
test("suspend / reactivate; cannot touch self or admins; audited", () => {
  assert.equal(call(G, "admin.updateUserStatus", { userId: D.sub, status: "suspended" }).ok, true);
  assert.equal(code(call(D, "cycles.list")), "ACCOUNT_DISABLED");
  assert.equal(call(G, "admin.updateUserStatus", { userId: D.sub, status: "active" }).ok, true);
  assert.equal(call(D, "cycles.list").ok, true);
  assert.equal(code(call(G, "admin.updateUserStatus", { userId: G.sub, status: "suspended" })), "VALIDATION_ERROR");
  assert.equal(code(call(G, "admin.updateUserStatus", { userId: F.sub, status: "suspended" })), "FORBIDDEN");
  assert.equal(code(call(G, "admin.updateUserStatus", { userId: "123456", status: "suspended" })), "NOT_FOUND");
  assert.equal(code(call(G, "admin.updateUserStatus", { userId: D.sub, status: "banned" })), "VALIDATION_ERROR");
  const log = call(F, "admin.getAuditLogs", { limit: 100 }).data.items.map((x) => x.action);
  assert.ok(log.includes("admin.updateUserStatus:suspended") && log.includes("admin.listUsers"));
});
test("maintenance mode blocks users, not admins", () => {
  assert.equal(call(F, "admin.updateSettings", { maintenanceMode: true }).data.maintenanceMode, true);
  assert.equal(code(call(D, "cycles.list")), "MAINTENANCE");
  assert.equal(call(F, "admin.getSettings").data.maintenanceMode, true);
  assert.equal(call(F, "admin.updateSettings", { maintenanceMode: false }).ok, true);
  assert.equal(call(D, "cycles.list").ok, true);
  assert.equal(code(call(F, "admin.updateSettings", { maintenanceMode: "yes" })), "VALIDATION_ERROR");
});
test("CMS: editor writes, users only see published", () => {
  const a = call(H, "admin.saveArticle", { title: "শিরোনাম", body: "লেখা", status: "draft" }).data;
  assert.equal(call(D, "content.list").data.items.length, 0);
  call(H, "admin.saveArticle", { id: a.id, title: "শিরোনাম", body: "লেখা ২", status: "published" });
  const pub = call(D, "content.list").data.items; assert.equal(pub.length, 1); assert.equal(pub[0].body, "লেখা ২");
  assert.equal(call(F, "admin.listArticles").data.items.length, 1);
  assert.equal(code(call(H, "admin.saveArticle", { title: "", body: "x", status: "draft" })), "VALIDATION_ERROR");
  assert.equal(code(call(H, "admin.saveArticle", { title: "t", body: "x".repeat(7000), status: "draft" })), "VALIDATION_ERROR");
  assert.equal(code(call(H, "admin.saveArticle", { id: "00000000-0000-0000-0000-000000000000", title: "t", body: "b", status: "draft" })), "NOT_FOUND");
  assert.equal(call(H, "admin.deleteArticle", { id: a.id }).ok, true);
  assert.equal(call(D, "content.list").data.items.length, 0);
});
test("export contains only my data", () => {
  const out = call(D, "user.exportData").data;
  assert.equal(out.profile.userId, D.sub); assert.ok(out.cycles.length >= 1 && out.dailyLogs.length >= 1);
  assert.ok(!JSON.stringify(out).includes(E.sub)); assert.ok(!JSON.stringify(out).includes('"userId":"' + E.sub));
  assert.ok(call(F, "admin.getAuditLogs", { limit: 100 }).data.items.some((x) => x.action === "user.export"));
});
test("delete account: needs confirmation, removes all of MY rows only, audited", () => {
  for (let i = 0; i < 3; i++) call(D, "dailyLogs.create", { date: dhaka(-5 - i) });
  assert.equal(code(call(D, "user.deleteAccount", {})), "VALIDATION_ERROR");
  assert.equal(code(call(D, "user.deleteAccount", { confirm: "delete" })), "VALIDATION_ERROR");
  const before = (n) => sheets[n].rows.filter((r, i) => i > 0 && r[1] === E.sub).length;
  const eRows = { Cycles: before("Cycles"), DailyLogs: before("DailyLogs"), Reminders: before("Reminders") };
  assert.equal(call(D, "user.deleteAccount", { confirm: "DELETE" }).data.deleted, true);
  for (const n of ["Cycles", "DailyLogs", "Reminders", "Consents"]) assert.equal(sheets[n].rows.filter((r, i) => i > 0 && r[1] === D.sub).length, 0, n);
  assert.equal(sheets.Users.rows.filter((r) => r[0] === D.sub).length, 0);
  assert.deepEqual({ Cycles: before("Cycles"), DailyLogs: before("DailyLogs"), Reminders: before("Reminders") }, eRows);
  assert.ok(call(F, "admin.getAuditLogs", { limit: 100 }).data.items.some((x) => x.action === "user.delete" && x.actorUserId === D.sub));
  assert.equal(call(D, "cycles.list").data.total, 0); // signing in again starts a brand-new empty account
});
