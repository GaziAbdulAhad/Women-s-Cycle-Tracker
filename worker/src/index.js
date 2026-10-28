// Cloudflare Worker — API gateway. Responsibilities ONLY: CORS, Google token verification, sessions,
// request limits, and signing requests to Apps Script. Business logic stays in Apps Script.
import { verifyGoogleIdToken, AuthError } from "./google.js";
import { createSession, readSession, destroySession, issueNonce, consumeNonce } from "./session.js";
import { hmacHex, randomToken } from "./crypto.js";

const MAX_BODY = 16000;
// Defense in depth: the Worker only forwards actions it knows. Keep in sync with apps-script/Code.gs.
const ALLOWED_ACTIONS = new Set([
  "user.me", "user.updateProfile", "user.exportData", "user.deleteAccount", "consents.list", "consents.record",
  "cycles.list", "cycles.create", "cycles.update", "cycles.delete", "dailyLogs.list", "dailyLogs.create", "dailyLogs.update", "dailyLogs.delete",
  "reminders.list", "reminders.update", "content.list",
  // Admin actions are forwarded too, but Apps Script decides by the AdminRoles sheet (the Worker knows no roles).
  "admin.whoami", "admin.getSummary", "admin.listUsers", "admin.updateUserStatus", "admin.getAuditLogs", "admin.getSettings", "admin.updateSettings",
  "admin.listArticles", "admin.saveArticle", "admin.deleteArticle"]);
const STATUS = { VALIDATION_ERROR: 400, BAD_REQUEST: 400, NOT_FOUND: 404, CONFLICT: 409, ACCOUNT_DISABLED: 403, FORBIDDEN: 403, MAINTENANCE: 503 };

class HttpError extends Error { constructor(status, code, message) { super(message); this.status = status; this.code = code; } }

// Best-effort, per-isolate limiter. NOT global: add a Cloudflare WAF rate-limiting rule for real protection.
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  let h = hits.get(key);
  if (!h || h.reset < now) { h = { n: 0, reset: now + windowMs }; hits.set(key, h); }
  return ++h.n > max;
}

function cors(env, request) {
  const o = request.headers.get("Origin");
  return o && o === env.ALLOWED_ORIGIN ? { "Access-Control-Allow-Origin": o, Vary: "Origin" } : { Vary: "Origin" };
}
function reply(env, request, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...cors(env, request) } });
}
const fail = (status, code, message) => { throw new HttpError(status, code, message); };

async function readJson(request) {
  if (!(request.headers.get("Content-Type") || "").includes("application/json")) fail(415, "UNSUPPORTED_MEDIA_TYPE", "Send JSON");
  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY) fail(413, "PAYLOAD_TOO_LARGE", "Request too large");
  const text = await request.text();
  if (text.length > MAX_BODY) fail(413, "PAYLOAD_TOO_LARGE", "Request too large");
  let v; try { v = JSON.parse(text); } catch { fail(400, "BAD_REQUEST", "Invalid JSON"); }
  if (!v || typeof v !== "object" || Array.isArray(v)) fail(400, "BAD_REQUEST", "Invalid request");
  return v;
}

// Signs an envelope exactly as apps-script/SecurityService.gs expects (HMAC over the envelope string).
async function callAppsScript(env, identity, action, payload) {
  const envelope = JSON.stringify({ v: 1, ts: Math.floor(Date.now() / 1000), nonce: randomToken(24), action,
    identity: { sub: identity.sub, email: identity.email, name: identity.name, picture: identity.picture }, payload });
  const sig = await hmacHex(envelope, env.GATEWAY_SECRET);
  let res;
  try {
    res = await fetch(env.APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ envelope, sig }), redirect: "follow", signal: AbortSignal.timeout(20000) });
  } catch { fail(502, "UPSTREAM_ERROR", "Service temporarily unavailable"); }
  let out; try { out = JSON.parse(await res.text()); } catch { out = null; }
  if (!out || typeof out.ok !== "boolean") fail(502, "UPSTREAM_ERROR", "Service temporarily unavailable");
  return out;
}

function relay(env, request, out, requestId) {
  if (out.ok) return reply(env, request, { ok: true, data: out.data, requestId });
  const code = out.error && out.error.code;
  if (!STATUS[code]) { console.error("upstream", requestId, code); fail(502, "UPSTREAM_ERROR", "Service temporarily unavailable"); } // never leak internals
  return reply(env, request, { ok: false, error: { code, message: String(out.error.message || "").slice(0, 200) }, requestId }, STATUS[code]);
}

async function route(request, env, requestId) {
  for (const k of ["GOOGLE_CLIENT_ID", "ALLOWED_ORIGIN", "APPS_SCRIPT_URL", "GATEWAY_SECRET"]) if (!env[k]) fail(500, "SERVER_MISCONFIGURED", "Server is not configured");
  if (!env.SESSIONS) fail(500, "SERVER_MISCONFIGURED", "Server is not configured");
  const { pathname } = new URL(request.url), method = request.method;
  if (pathname === "/health" && method === "GET") return reply(env, request, { ok: true, requestId });

  // Browsers always send Origin on cross-origin calls. Anything else is refused.
  if (request.headers.get("Origin") !== env.ALLOWED_ORIGIN) fail(403, "FORBIDDEN_ORIGIN", "Origin not allowed");
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors(env, request), "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "600" } });
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  if (pathname === "/auth/nonce" && method === "GET") {
    if (limited("nonce:" + ip, 30, 600000)) fail(429, "RATE_LIMITED", "Too many requests");
    return reply(env, request, { ok: true, data: { nonce: await issueNonce(env) }, requestId });
  }
  if (pathname === "/auth/login" && method === "POST") {
    if (limited("login:" + ip, 10, 600000)) fail(429, "RATE_LIMITED", "Too many requests");
    const body = await readJson(request);
    let claims;
    try { claims = await verifyGoogleIdToken(body.credential, { clientId: env.GOOGLE_CLIENT_ID }); }
    catch (e) { if (e instanceof AuthError) { console.warn("login rejected", requestId, e.reason); fail(401, "UNAUTHENTICATED", "Sign-in failed"); } throw e; }
    if (!(await consumeNonce(env, claims.nonce))) fail(401, "UNAUTHENTICATED", "Sign-in failed");
    const identity = { sub: claims.sub, email: claims.email, name: claims.name, picture: claims.picture };
    const out = await callAppsScript(env, identity, "user.me", {}); // creates the account; refuses disabled ones BEFORE a session exists
    if (!out.ok) return relay(env, request, out, requestId);
    const s = await createSession(env, identity);
    return reply(env, request, { ok: true, data: { session: s.token, expiresAt: s.expiresAt, user: out.data }, requestId });
  }
  if (pathname === "/auth/logout" && method === "POST") {
    const s = await readSession(env, request);
    if (s) await destroySession(env, s.hash);
    return reply(env, request, { ok: true, data: {}, requestId });
  }
  if (pathname === "/api" && method === "POST") {
    const s = await readSession(env, request);
    if (!s) fail(401, "UNAUTHENTICATED", "Please sign in again");
    if (limited("api:" + s.sub, 120, 60000)) fail(429, "RATE_LIMITED", "Too many requests");
    const body = await readJson(request);
    if (typeof body.action !== "string" || !ALLOWED_ACTIONS.has(body.action)) fail(400, "UNKNOWN_ACTION", "Unknown action");
    const payload = body.payload === undefined ? {} : body.payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail(400, "BAD_REQUEST", "Invalid payload");
    const out = await callAppsScript(env, s, body.action, payload); // identity comes from the session, never from the client
    if (!out.ok && out.error && out.error.code === "ACCOUNT_DISABLED") await destroySession(env, s.hash);
    if (out.ok && body.action === "user.deleteAccount") await destroySession(env, s.hash); // the account no longer exists
    return relay(env, request, out, requestId);
  }
  fail(404, "NOT_FOUND", "Not found");
}

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    try { return await route(request, env, requestId); }
    catch (e) {
      if (e instanceof HttpError) return reply(env, request, { ok: false, error: { code: e.code, message: e.message }, requestId }, e.status);
      console.error("unhandled", requestId, e && e.name); // no tokens / payloads in logs
      return reply(env, request, { ok: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" }, requestId }, 500);
    }
  },
};
