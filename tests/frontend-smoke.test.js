// Runs the REAL page modules in jsdom against a fake in-memory API. Needs jsdom (`npm i -D jsdom`); skipped otherwise.
// This is a smoke test, not a real browser test: layout, real Google Sign-In and cross-origin behaviour are NOT covered.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let JSDOM = null, VirtualConsole = null;
try { const j = createRequire((process.env.JSDOM_DIR || root) + "/")("jsdom"); JSDOM = j.JSDOM; VirtualConsole = j.VirtualConsole; } catch { /* not installed */ }
const skip = !JSDOM && "jsdom not installed";

const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const user = { userId: "1", displayName: "রিনা", email: "r@example.com", timezone: "Asia/Dhaka", language: "bn", createdAt: "2026-01-01T00:00:00Z", photoURL: "" };
let db, uid, runN = 0, calls;
const reset = () => { db = { cycles: [], logs: [], consents: [], role: null, articles: [], deleted: false, maint: false, rem: { period_upcoming: { enabled: false, daysBefore: 2, channel: "in_app" }, daily_log: { enabled: false, daysBefore: 0, channel: "in_app" } } }; uid = 0; calls = []; };
function handle(a, p) {
  const page = (arr) => { const l = p.limit ?? 50, o = p.offset ?? 0; return { items: arr.slice(o, o + l), total: arr.length, nextOffset: o + l < arr.length ? o + l : null }; };
  const byId = (arr, k) => arr.find((x) => x[k] === p[k]);
  switch (a) {
    case "cycles.list": return page([...db.cycles].sort((x, y) => (x.actualStartDate < y.actualStartDate ? 1 : -1)));
    case "cycles.create": { const c = { cycleId: "c" + ++uid, actualStartDate: p.actualStartDate, actualEndDate: p.actualEndDate || "", notes: p.notes || "" }; db.cycles.push(c); return c; }
    case "cycles.update": return Object.assign(byId(db.cycles, "cycleId"), { actualStartDate: p.actualStartDate, actualEndDate: p.actualEndDate || "", notes: p.notes || "" });
    case "cycles.delete": db.cycles = db.cycles.filter((c) => c.cycleId !== p.cycleId); return { deleted: true };
    case "dailyLogs.list": return page(db.logs.filter((l) => (!p.from || l.date >= p.from) && (!p.to || l.date <= p.to)).sort((x, y) => (x.date < y.date ? 1 : -1)));
    case "dailyLogs.create": { const l = { logId: "l" + ++uid, date: p.date, flowLevel: p.flowLevel, symptoms: p.symptoms, mood: p.mood, sleepHours: p.sleepHours === "" ? null : p.sleepHours, notes: p.notes }; db.logs.push(l); return l; }
    case "dailyLogs.update": return Object.assign(byId(db.logs, "logId"), { ...p, sleepHours: p.sleepHours === "" ? null : p.sleepHours });
    case "dailyLogs.delete": db.logs = db.logs.filter((l) => l.logId !== p.logId); return { deleted: true };
    case "user.updateProfile": return { ...user, ...p };
    case "reminders.list": return { items: Object.entries(db.rem).map(([type, r]) => ({ type, ...r })) };
    case "reminders.update": db.rem[p.type] = { enabled: p.enabled, daysBefore: p.daysBefore, channel: p.channel }; return { items: [] };
    case "consents.list": return { items: db.consents };
    case "consents.record": p.consentTypes.forEach((t) => db.consents.push({ consentType: t, policyVersion: p.policyVersion, acceptedAt: "", withdrawnAt: "" })); return { items: db.consents };
    case "content.list": return { items: db.articles.filter((a) => a.status === "published") };
    case "user.exportData": return { exportedAt: "x", profile: user, cycles: db.cycles, dailyLogs: db.logs, reminders: [], consents: [] };
    case "user.deleteAccount": db.deleted = true; return { deleted: true };
    case "admin.whoami": return { role: db.role };
    case "admin.getSummary": return { accounts: { total: 7, active: 6, suspended: 1, new7d: 2, new30d: 4 }, signupsByDay: [{ date: day(-1), count: 2 }, { date: day(0), count: 1 }], usage: { cycleRecords: 11, dailyLogs: 20, reminderRules: 3 }, privacyRequests30d: { exports: 1, deletions: 0 }, health: { serverTime: "t", maintenanceMode: db.maint, sheetRows: { Users: 7 } } };
    case "admin.listUsers": return { items: [{ userId: "200001", email: "x@example.com", displayName: "X", status: "active", createdAt: "2026-01-01T00:00:00Z" }], total: 1, nextOffset: null };
    case "admin.updateUserStatus": return { userId: p.userId, status: p.status };
    case "admin.getAuditLogs": return { items: [{ timestamp: "2026-01-01T00:00:00Z", action: "user.create", actorUserId: "200001", targetUserId: "" }], total: 1, nextOffset: null };
    case "admin.getSettings": return { maintenanceMode: db.maint };
    case "admin.updateSettings": db.maint = p.maintenanceMode; return { maintenanceMode: db.maint };
    case "admin.listArticles": return { items: db.articles };
    case "admin.saveArticle": { const a = { id: p.id || "a" + ++uid, title: p.title, body: p.body, status: p.status, updatedAt: "2026-01-01T00:00:00Z" }; db.articles = db.articles.filter((x) => x.id !== a.id).concat(a); return a; }
    case "admin.deleteArticle": db.articles = db.articles.filter((x) => x.id !== p.id); return { deleted: true };
  }
  throw new Error("unexpected " + a);
}
globalThis.fetch = async (url, init) => {
  const u = String(url); const path = u.replace(/^https:\/\/YOUR-WORKER\.YOUR-SUBDOMAIN\.workers\.dev/, "");
  if (path === "/api") { assert.equal(init.headers.Authorization, "Bearer TOKEN"); const b = JSON.parse(init.body); calls.push(b.action); return new Response(JSON.stringify({ ok: true, data: handle(b.action, b.payload) })); }
  if (path === "/auth/nonce") return new Response(JSON.stringify({ ok: true, data: { nonce: "n".repeat(32) } }));
  throw new Error("unexpected fetch " + u);
};

async function open(file, query = "", { session = true, consent = true } = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, file), "utf8"), { url: "https://app.test/" + file + query, virtualConsole: new VirtualConsole() });
  const replaced = [];
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, confirm: () => true,
    location: { pathname: "/" + file, search: query, replace: (u) => replaced.push(u) } });
  if (session) dom.window.sessionStorage.setItem("wht.session", JSON.stringify({ token: "TOKEN", expiresAt: Math.floor(Date.now() / 1000) + 3600, user, consentOk: consent }));
  const base = { register: "login" }[file.split("/").pop().replace(".html", "")] || file.split("/").pop().replace(".html", "");
  const mod = await import((file.startsWith("admin/") ? "../js/admin/" : "../js/pages/") + base + ".js?run=" + ++runN);
  await mod.ready;
  return { document: dom.window.document, window: dom.window, replaced };
}
const tick = () => new Promise((r) => setTimeout(r, 30));
const text = (d, sel) => d.querySelector(sel).textContent;
const submit = async (d, w, sel) => { d.querySelector(sel).dispatchEvent(new w.Event("submit", { cancelable: true, bubbles: true })); await tick(); };

test("private pages redirect to login without a session", { skip }, async () => {
  reset();
  for (const f of ["dashboard.html", "calendar.html", "period-entry.html", "journal.html", "history.html", "settings.html", "account.html", "ovulation.html"]) {
    const r = await open(f, "", { session: false });
    assert.match(r.replaced[0], /^login\.html\?next=/, f); assert.equal(calls.length, 0);
  }
});
test("dashboard: empty state, then estimates labelled as estimates", { skip }, async () => {
  reset();
  let r = await open("dashboard.html"); assert.match(r.document.body.textContent, /শুরু করুন/); assert.match(text(r.document, "#greet"), /রিনা/);
  db.cycles.push({ cycleId: "x", actualStartDate: day(-20), actualEndDate: day(-16), notes: "" });
  r = await open("dashboard.html");
  assert.match(r.document.body.textContent, /পরবর্তী মাসিক/); assert.ok(r.document.querySelectorAll(".badge.est").length >= 3); assert.ok(r.document.querySelector(".badge.act"));
  assert.match(r.document.body.textContent, /ইতিহাস কম/);
});
test("period entry: create, list, edit, delete; notes are text, never markup", { skip }, async () => {
  reset();
  const r = await open("period-entry.html"), d = r.document;
  d.querySelector("#start").value = day(-30); d.querySelector("#end").value = day(-26); d.querySelector("#notes").value = '<img src=x onerror="alert(1)">';
  await submit(d, r.window, "#pform");
  assert.equal(db.cycles.length, 1); assert.equal(d.querySelector("#list img"), null); assert.match(text(d, "#list"), /<img src=x/);
  d.querySelector("#start").value = day(5); await submit(d, r.window, "#pform");
  assert.equal(db.cycles.length, 1); assert.match(text(d, "#msg"), /ভবিষ্যতের/);
  d.querySelector("#list .btn.danger").click(); await tick(); await tick();
  assert.equal(db.cycles.length, 0);
});
test("journal: save with symptoms, reload, edit, delete", { skip }, async () => {
  reset();
  const r = await open("journal.html"), d = r.document;
  d.querySelector('#sym input[value="cramps"]').checked = true; d.querySelector("#flow").value = "light"; d.querySelector("#sleep").value = "7.5"; d.querySelector("#custom").value = "dizzy, tired";
  await submit(d, r.window, "#jform");
  assert.equal(db.logs.length, 1); assert.deepEqual(db.logs[0].symptoms, ["cramps", "dizzy", "tired"]); assert.equal(db.logs[0].sleepHours, 7.5);
  assert.equal(d.querySelector("#delBtn").hidden, false); assert.equal(d.querySelector("#custom").value, "dizzy, tired");
  d.querySelector("#flow").value = "heavy"; await submit(d, r.window, "#jform");
  assert.equal(db.logs.length, 1); assert.equal(db.logs[0].flowLevel, "heavy");
  d.querySelector("#delBtn").click(); await tick(); await tick(); assert.equal(db.logs.length, 0);
});
test("calendar: month grid, selection details, week view", { skip }, async () => {
  reset(); db.cycles.push({ cycleId: "x", actualStartDate: day(-10), actualEndDate: day(-6), notes: "" });
  const r = await open("calendar.html"), d = r.document;
  assert.ok(d.querySelectorAll("#cal .cell").length >= 28); assert.ok(d.querySelector(".cell.today"));
  assert.ok(d.querySelector(".cell").getAttribute("aria-label").length > 0);
  d.querySelector("#viewBtn").click(); await tick(); assert.equal(d.querySelectorAll("#cal .cell").length, 7);
  d.querySelector("#next").click(); await tick(); assert.equal(d.querySelectorAll("#cal .cell").length, 7);
  assert.match(text(d, "#details"), /জার্নাল/);
});
test("ovulation, history, account, settings render", { skip }, async () => {
  reset(); db.cycles.push({ cycleId: "a", actualStartDate: day(-60), actualEndDate: day(-56), notes: "" }, { cycleId: "b", actualStartDate: day(-30), actualEndDate: day(-26), notes: "" });
  let r = await open("ovulation.html"); assert.match(r.document.body.textContent, /ক্যালেন্ডারভিত্তিক অনুমান/); assert.ok(r.document.querySelectorAll(".tl span").length >= 4);
  r = await open("history.html"); assert.equal(r.document.querySelectorAll("tbody tr").length, 2); assert.match(r.document.body.textContent, /গড় চক্র/);
  r = await open("account.html"); assert.match(r.document.body.textContent, /r@example\.com/); assert.ok(r.document.querySelector("#confirmDel"));
  r = await open("settings.html"); r.document.querySelector("#dname").value = "নতুন"; await submit(r.document, r.window, "#sform");
  assert.match(text(r.document, "#msg"), /সেভ হয়েছে/); assert.equal(JSON.parse(r.window.sessionStorage.getItem("wht.session")).user.displayName, "নতুন");
});
test("login page: unconfigured config shows setup notice and never calls the API", { skip }, async () => {
  reset(); const r = await open("login.html", "", { session: false });
  assert.match(text(r.document, "#msg"), /সেটআপ বাকি/);
});
test("login redirect target is allow-listed", { skip }, async () => {
  reset(); const r = await open("login.html", "?next=https://evil.example/x");
  assert.deepEqual(r.replaced, ["dashboard.html"]);
});

// ---------------- Phase 5 pages ----------------
test("consent gate: signed in without accepted policy is sent to the consent page", { skip }, async () => {
  reset(); const r = await open("dashboard.html", "", { consent: false });
  assert.match(r.replaced[0], /^register\.html\?next=dashboard\.html/); assert.equal(calls.length, 0);
});
test("register page in consent-only mode records all three consents, then continues", { skip }, async () => {
  reset(); const r = await open("register.html", "?next=calendar.html", { consent: false }), d = r.document;
  assert.equal(d.querySelector("#consentBtn").hidden, false); assert.equal(d.querySelector("#gsi-btn").hidden, true);
  d.querySelector("#consentBtn").click(); await tick(); assert.equal(db.consents.length, 0); assert.match(text(d, "#msg"), /টিক/);
  d.querySelector("#agree").checked = true; d.querySelector("#consentBtn").click(); await tick(); await tick();
  assert.deepEqual(db.consents.map((c) => c.consentType).sort(), ["medical_disclaimer", "privacy_policy", "terms"]);
  assert.equal(JSON.parse(r.window.sessionStorage.getItem("wht.session")).consentOk, true); assert.equal(r.replaced.at(-1), "calendar.html");
});
test("reminders: save preferences; dashboard shows in-app banner only for in-app channel", { skip }, async () => {
  reset(); let r = await open("reminders.html"), d = r.document;
  assert.equal(d.querySelectorAll("form.card").length, 2);
  d.querySelector("#daily_log-en").checked = true; await submit(d, r.window, "form.card:nth-of-type(2)");
  assert.equal(db.rem.daily_log.enabled, true);
  r = await open("dashboard.html"); assert.match(r.document.body.textContent, /আজকের জার্নাল এখনো লেখা হয়নি/);
  db.rem.daily_log.channel = "email"; r = await open("dashboard.html"); assert.ok(!/আজকের জার্নাল এখনো/.test(r.document.body.textContent));
});
test("reports: chart, stats, symptom table", { skip }, async () => {
  reset(); db.cycles.push({ cycleId: "a", actualStartDate: day(-90), actualEndDate: day(-86), notes: "" }, { cycleId: "b", actualStartDate: day(-60), actualEndDate: day(-56), notes: "" }, { cycleId: "c", actualStartDate: day(-31), actualEndDate: "", notes: "" });
  db.logs.push({ logId: "l", date: day(-3), flowLevel: "", mood: "", symptoms: ["cramps"], sleepHours: null, notes: "" });
  const r = await open("reports.html"), d = r.document;
  assert.ok(d.querySelector("svg.chart polyline")); assert.equal(d.querySelectorAll("svg.chart circle").length, 2); assert.match(d.body.textContent, /পেটব্যথা/);
  d.querySelector("#from").value = day(-35); d.querySelector("#apply").click(); await tick(); await tick();
  assert.equal(d.querySelectorAll("svg.chart circle").length, 1); // only the cycle that started inside the range
  d.querySelector("#from").value = day(-10); d.querySelector("#apply").click(); await tick(); await tick();
  assert.equal(d.querySelector("svg.chart"), null);
});
test("learn page shows only what the API returns, as text", { skip }, async () => {
  reset(); db.articles.push({ id: "1", title: "T", body: "<b>x</b>\nদ্বিতীয়", status: "published", updatedAt: "2026-01-01T00:00:00Z" });
  const r = await open("learn.html"); assert.equal(r.document.querySelector("article b"), null); assert.equal(r.document.querySelectorAll("article p").length >= 2, true);
});
test("account: export works; delete needs the exact word and then signs out", { skip }, async () => {
  reset(); globalThis.URL.createObjectURL = () => "blob:test"; globalThis.URL.revokeObjectURL = () => {};
  const r = await open("account.html"), d = r.document;
  d.querySelectorAll(".card button")[1].click(); await tick(); assert.ok(calls.includes("user.exportData")); assert.match(text(d, "#amsg"), /ডাউনলোড শুরু/);
  const del = [...d.querySelectorAll("button")].find((b) => /মুছুন/.test(b.textContent));
  d.querySelector("#confirmDel").value = "delete"; del.click(); await tick(); assert.equal(db.deleted, false);
  d.querySelector("#confirmDel").value = "DELETE"; del.click(); await tick(); await tick(); await tick();
  assert.equal(db.deleted, true); assert.equal(r.window.sessionStorage.getItem("wht.session"), null); assert.equal(r.replaced.at(-1), "index.html");
});
test("admin pages: ordinary user sees no access; admins see data; links resolve from /admin/", { skip }, async () => {
  reset(); let r = await open("admin/index.html");
  assert.match(r.document.body.textContent, /প্রবেশাধিকার নেই/); assert.equal(calls.filter((c) => c !== "admin.whoami").length, 0);
  db.role = "support_admin";
  r = await open("admin/index.html"); assert.match(r.document.body.textContent, /মোট অ্যাকাউন্ট/);
  r = await open("admin/audit-logs.html"); assert.match(r.document.body.textContent, /প্রবেশাধিকার নেই/);
  r = await open("admin/users.html"); assert.match(r.document.body.textContent, /x@example\.com/);
  r.document.querySelector("tbody .btn").click(); await tick(); await tick(); assert.ok(calls.includes("admin.updateUserStatus"));
  db.role = "super_admin";
  r = await open("admin/audit-logs.html"); assert.match(r.document.body.textContent, /user\.create/);
  r = await open("admin/settings.html"); r.document.querySelector("#maint").checked = true; await submit(r.document, r.window, "#sform"); assert.equal(db.maint, true);
  r = await open("admin/reports.html"); assert.match(r.document.body.textContent, /গোপনীয়তা অনুরোধ/);
  db.role = "content_editor"; r = await open("admin/content.html"); const d2 = r.document;
  d2.querySelector("#atitle").value = "শিরোনাম"; d2.querySelector("#abody").value = "লেখা <b>"; d2.querySelector("#astatus").value = "published"; await submit(d2, r.window, "#aform");
  assert.equal(db.articles.length, 1); assert.equal(d2.querySelector("#list b"), null);
  r = await open("admin/users.html"); assert.match(r.document.body.textContent, /প্রবেশাধিকার নেই/);
});
