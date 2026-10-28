// End-to-end: real Worker code -> (mocked network) -> real Apps Script code in a vm.
// Google's JWKS endpoint is mocked with a locally generated RSA key. This proves the Worker/Apps Script
// contract and our checks; it does NOT prove behaviour against real Google or a real deployment.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import worker from "../worker/src/index.js";
import { createGas } from "./helpers/gas.js";

const SECRET = "gw-secret-" + "z".repeat(40);
const CLIENT_ID = "test-client.apps.googleusercontent.com";
const ORIGIN = "https://app.example.github.io";
const SCRIPT_URL = "https://script.google.com/macros/s/TESTID/exec";
const gas = createGas(SECRET);
const kv = new Map();
const env = { GOOGLE_CLIENT_ID: CLIENT_ID, ALLOWED_ORIGIN: ORIGIN, APPS_SCRIPT_URL: SCRIPT_URL, GATEWAY_SECRET: SECRET, SESSION_TTL_SECONDS: "7200",
  SESSIONS: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => void kv.set(k, v), delete: async (k) => void kv.delete(k) } };

const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const otherPair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwks = { keys: [{ ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" }] };
let scriptDown = false, scriptReply = null;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://www.googleapis.com/oauth2/v3/certs")) return new Response(JSON.stringify(jwks));
  if (String(url) === SCRIPT_URL) {
    if (scriptDown) throw new Error("network");
    if (scriptReply) return new Response(scriptReply);
    return new Response(gas.doPost({ postData: { contents: init.body } }).s);
  }
  throw new Error("unexpected fetch " + url);
};

const now = () => Math.floor(Date.now() / 1000);
async function jwt(claims, { key = pair.privateKey, header = { alg: "RS256", kid: "k1", typ: "JWT" } } = {}) {
  const input = b64(header) + "." + b64(claims);
  const sig = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, Buffer.from(input))).toString("base64url");
  return input + "." + sig;
}
let ipN = 0;
const req = (path, { method = "POST", body, token, origin = ORIGIN, ip, type = "application/json", raw } = {}) => {
  const h = { "CF-Connecting-IP": ip || "10.0." + Math.floor(++ipN / 250) + "." + (ipN % 250) };
  if (origin) h.Origin = origin; if (token) h.Authorization = "Bearer " + token; if (type) h["Content-Type"] = type;
  return worker.fetch(new Request("https://gw.example" + path, { method, headers: h, body: method === "GET" ? undefined : raw ?? JSON.stringify(body ?? {}) }), env);
};
const j = async (r) => r.json();
const nonce = async () => (await j(await req("/auth/nonce", { method: "GET" }))).data.nonce;
let uid = 200000;
const claimsFor = async (sub, over = {}) => ({ iss: "https://accounts.google.com", aud: CLIENT_ID, sub, email: sub + "@example.com", email_verified: true, name: "U" + sub, iat: now(), exp: now() + 3600, nonce: await nonce(), ...over });
async function login(sub = String(++uid), over = {}, jwtOpts) { const r = await req("/auth/login", { body: { credential: await jwt(await claimsFor(sub, over), jwtOpts) } }); return { r, body: await j(r), sub }; }
const api = async (token, action, payload) => { const r = await req("/api", { token, body: { action, payload } }); return { status: r.status, body: await j(r) }; };
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

test("health works; other routes require the exact allowed Origin", async () => {
  assert.equal((await req("/health", { method: "GET", origin: null })).status, 200);
  for (const origin of [null, "https://evil.example", ORIGIN + "/", "http://app.example.github.io"]) {
    const r = await req("/auth/nonce", { method: "GET", origin });
    assert.equal(r.status, 403); assert.equal(r.headers.get("Access-Control-Allow-Origin"), null);
  }
});
test("CORS preflight: allowed origin gets exact-origin headers (never *), others refused", async () => {
  const ok = await req("/api", { method: "OPTIONS" });
  assert.equal(ok.status, 204); assert.equal(ok.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.match(ok.headers.get("Access-Control-Allow-Headers"), /Authorization/);
  assert.equal((await req("/api", { method: "OPTIONS", origin: "https://evil.example" })).status, 403);
});
test("valid Google token -> session -> real Apps Script round trip", async () => {
  const { r, body, sub } = await login();
  assert.equal(r.status, 200); assert.equal(body.data.user.userId, sub);
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  const t = body.data.session;
  const c = await api(t, "cycles.create", { actualStartDate: day(-20) });
  assert.equal(c.status, 200);
  assert.equal((await api(t, "cycles.list", {})).body.data.total, 1);
  assert.equal((await api(t, "user.updateProfile", { language: "en" })).body.data.language, "en");
});
test("session tokens are not stored in plaintext", async () => {
  const { body } = await login();
  for (const k of kv.keys()) assert.ok(!k.includes(body.data.session));
});
test("login rejects bad tokens", async () => {
  const cases = {
    "wrong signing key": () => login(String(++uid), {}, { key: otherPair.privateKey }),
    "wrong audience": () => login(String(++uid), { aud: "other" }),
    "wrong issuer": () => login(String(++uid), { iss: "https://evil.example" }),
    "expired": () => login(String(++uid), { iat: now() - 7200, exp: now() - 3600 }),
    "stale iat": () => login(String(++uid), { iat: now() - 3000, exp: now() + 600 }),
    "unverified email": () => login(String(++uid), { email_verified: false }),
    "no nonce match": () => login(String(++uid), { nonce: "A".repeat(32) }),
    "alg none": () => login(String(++uid), {}, { header: { alg: "none", kid: "k1" } }),
    "alg HS256": () => login(String(++uid), {}, { header: { alg: "HS256", kid: "k1" } }),
    "unknown kid": () => login(String(++uid), {}, { header: { alg: "RS256", kid: "nope" } }),
  };
  for (const [name, f] of Object.entries(cases)) { const { r, body } = await f(); assert.equal(r.status, 401, name); assert.equal(body.error.code, "UNAUTHENTICATED", name); assert.equal(body.data, undefined, name); }
  for (const credential of [undefined, "", "a.b", "a.b.c", 123, "x".repeat(5000)]) assert.equal((await req("/auth/login", { body: { credential } })).status, 401);
});
test("nonce is single-use (replayed token rejected)", async () => {
  const c = await jwt(await claimsFor("300001"));
  assert.equal((await req("/auth/login", { body: { credential: c } })).status, 200);
  assert.equal((await req("/auth/login", { body: { credential: c } })).status, 401);
});
test("api rejects missing, malformed and unknown sessions", async () => {
  for (const token of [undefined, "short", "A".repeat(43), "!".repeat(43)]) assert.equal((await api(token, "cycles.list", {})).status, 401);
});
test("logout revokes the session", async () => {
  const t = (await login()).body.data.session;
  assert.equal((await api(t, "cycles.list", {})).status, 200);
  assert.equal((await req("/auth/logout", { token: t })).status, 200);
  assert.equal((await api(t, "cycles.list", {})).status, 401);
});
test("expired session rejected", async () => {
  const t = (await login()).body.data.session;
  for (const [k, v] of kv) if (k.startsWith("s:")) { const o = JSON.parse(v); if (o.exp > now()) { o.exp = now() - 1; kv.set(k, JSON.stringify(o)); } }
  assert.equal((await api(t, "cycles.list", {})).status, 401);
});
test("disabled account: cannot log in; existing session is revoked", async () => {
  const a = await login("400001"); const t = a.body.data.session;
  gas.sheets.Users.rows.find((r) => r[0] === "400001")[4] = "suspended";
  const r = await api(t, "cycles.list", {});
  assert.equal(r.status, 403); assert.equal(r.body.error.code, "ACCOUNT_DISABLED");
  assert.equal((await api(t, "cycles.list", {})).status, 401);
  const again = await login("400001"); assert.equal(again.r.status, 403); assert.equal(again.body.data, undefined);
});
test("user isolation through the whole stack", async () => {
  const A = (await login()).body.data.session, B = (await login()).body.data.session;
  const id = (await api(A, "cycles.create", { actualStartDate: day(-40) })).body.data.cycleId;
  assert.equal((await api(B, "cycles.list", {})).body.data.total, 0);
  assert.equal((await api(B, "cycles.delete", { cycleId: id })).status, 404);
  assert.equal((await api(B, "cycles.update", { cycleId: id, actualStartDate: day(-3) })).status, 404);
  assert.equal((await api(A, "cycles.list", {})).body.data.total, 1);
});
test("client cannot choose identity or call unlisted actions", async () => {
  const t = (await login()).body.data.session;
  for (const a of ["admin.nope", "health.check", "__proto__", "reports.getCycleHistory", 5]) { const r = await api(t, a, {}); assert.equal(r.status, 400); assert.equal(r.body.error.code, "UNKNOWN_ACTION"); }
  assert.equal((await api(t, "cycles.list", [])).status, 400);
  const r = await req("/api", { token: t, body: { action: "user.me", payload: {}, identity: { sub: "999999" }, userId: "999999" } });
  assert.notEqual((await j(r)).data.userId, "999999");
});
test("validation errors from Apps Script pass through with correct status", async () => {
  const t = (await login()).body.data.session;
  assert.equal((await api(t, "cycles.create", { actualStartDate: day(9) })).status, 400);
  await api(t, "cycles.create", { actualStartDate: day(-30) });
  assert.equal((await api(t, "cycles.create", { actualStartDate: day(-29) })).status, 409);
});
test("size and content-type limits", async () => {
  const t = (await login()).body.data.session;
  assert.equal((await req("/api", { token: t, raw: "x".repeat(20000) })).status, 413);
  assert.equal((await req("/api", { token: t, type: "text/plain", raw: "{}" })).status, 415);
  assert.equal((await req("/api", { token: t, raw: "not json" })).status, 400);
});
test("upstream failures return a generic 502 and leak nothing", async () => {
  const t = (await login()).body.data.session;
  for (const mode of ["down", "garbage", "internal", "misconfigured"]) {
    scriptDown = mode === "down"; scriptReply = mode === "garbage" ? "<html>Error</html>" : mode === "internal" ? JSON.stringify({ ok: false, error: { code: "INTERNAL_ERROR", message: "stack at Code.gs:1" } }) : mode === "misconfigured" ? JSON.stringify({ ok: false, error: { code: "UNAUTHENTICATED", message: "Invalid request" } }) : null;
    const r = await req("/api", { token: t, body: { action: "cycles.list", payload: {} } }); const txt = await r.text();
    assert.equal(r.status, 502, mode); assert.ok(!txt.includes("Code.gs") && !txt.includes(SECRET) && !txt.includes(SCRIPT_URL), mode);
  }
  scriptDown = false; scriptReply = null;
});
test("wrong gateway secret is rejected by Apps Script and surfaced as 502", async () => {
  const t = (await login()).body.data.session; const saved = env.GATEWAY_SECRET; env.GATEWAY_SECRET = "wrong";
  assert.equal((await api(t, "cycles.list", {})).status, 502); env.GATEWAY_SECRET = saved;
});
test("login is rate limited per IP", async () => {
  const ip = "203.0.113.9"; let last;
  for (let i = 0; i < 11; i++) last = await req("/auth/login", { ip, body: { credential: "x" } });
  assert.equal(last.status, 429);
});
test("missing configuration fails closed", async () => {
  const saved = env.GATEWAY_SECRET; delete env.GATEWAY_SECRET;
  assert.equal((await req("/auth/nonce", { method: "GET" })).status, 500); env.GATEWAY_SECRET = saved;
});

// ================= Phase 5 through the whole stack =================
const grantRole = (sub, role) => gas.sheets.AdminRoles.rows.push([sub, role, "true", "", ""]);
test("admin actions: ordinary session gets 403; granted roles work; roles can't be self-assigned", async () => {
  const U = await login(); const t = U.body.data.session;
  const r = await api(t, "admin.getSummary", {}); assert.equal(r.status, 403); assert.equal(r.body.error.code, "FORBIDDEN");
  assert.equal((await api(t, "admin.whoami", {})).body.data.role, null);
  assert.equal((await api(t, "user.updateProfile", { role: "super_admin", userId: U.sub })).status, 200);
  assert.equal((await api(t, "admin.getSummary", {})).status, 403);
  grantRole(U.sub, "super_admin");
  assert.equal((await api(t, "admin.getSummary", {})).status, 200);
  assert.equal((await api(t, "admin.whoami", {})).body.data.role, "super_admin");
});
test("maintenance mode returns 503 to users but admins can switch it off", async () => {
  const adm = await login(); grantRole(adm.sub, "super_admin"); const at = adm.body.data.session;
  const usr = (await login()).body.data.session;
  assert.equal((await api(at, "admin.updateSettings", { maintenanceMode: true })).status, 200);
  const r = await api(usr, "cycles.list", {}); assert.equal(r.status, 503); assert.equal(r.body.error.code, "MAINTENANCE");
  assert.equal((await api(at, "admin.updateSettings", { maintenanceMode: false })).status, 200);
  assert.equal((await api(usr, "cycles.list", {})).status, 200);
});
test("export then delete account: data gone and session revoked", async () => {
  const U = await login(); const t = U.body.data.session;
  await api(t, "cycles.create", { actualStartDate: day(-20), notes: "mine" });
  const ex = await api(t, "user.exportData", {}); assert.equal(ex.status, 200); assert.equal(ex.body.data.cycles.length, 1);
  assert.equal((await api(t, "user.deleteAccount", {})).status, 400);
  assert.equal((await api(t, "user.deleteAccount", { confirm: "DELETE" })).status, 200);
  assert.equal((await api(t, "cycles.list", {})).status, 401);
  assert.equal(gas.sheets.Cycles.rows.filter((r) => r[1] === U.sub).length, 0);
  assert.equal(gas.sheets.Users.rows.filter((r) => r[0] === U.sub).length, 0);
});
test("consents and reminders through the gateway", async () => {
  const t = (await login()).body.data.session;
  assert.equal((await api(t, "consents.list", {})).body.data.items.length, 0);
  assert.equal((await api(t, "consents.record", { policyVersion: "v1", consentTypes: ["privacy_policy", "terms"] })).body.data.items.length, 2);
  assert.equal((await api(t, "reminders.update", { type: "daily_log", enabled: true, daysBefore: 0, channel: "in_app" })).status, 200);
  assert.equal((await api(t, "reminders.list", {})).body.data.items.find((x) => x.type === "daily_log").enabled, true);
});
test("a 6000-character Bengali article fits through the size limits", async () => {
  const ed = await login(); grantRole(ed.sub, "content_editor");
  const r = await api(ed.body.data.session, "admin.saveArticle", { title: "শিরোনাম", body: "ক".repeat(5900) + "\n", status: "published" });
  assert.equal(r.status, 200);
});
