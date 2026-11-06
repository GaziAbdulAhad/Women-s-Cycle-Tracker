// Opaque, revocable sessions in KV. The browser holds a random token; KV holds only its SHA-256 hash.
import { randomToken, sha256Hex, hmacHex, safeEqual } from "./crypto.js";

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const ttlOf = (env) => Math.min(28800, Math.max(300, Number(env.SESSION_TTL_SECONDS) || 7200));

export async function createSession(env, user) {
  const token = randomToken(32), ttl = ttlOf(env), exp = Math.floor(Date.now() / 1000) + ttl;
  const rec = { sub: user.sub, email: user.email, name: user.name, picture: user.picture, exp };
  await env.SESSIONS.put("s:" + (await sha256Hex(token)), JSON.stringify(rec), { expirationTtl: ttl });
  return { token, expiresAt: exp };
}
export async function readSession(env, request) {
  const m = /^Bearer (\S+)$/.exec(request.headers.get("Authorization") || "");
  if (!m || !TOKEN_RE.test(m[1])) return null;
  const hash = await sha256Hex(m[1]);
  const raw = await env.SESSIONS.get("s:" + hash);
  if (!raw) return null;
  let s; try { s = JSON.parse(raw); } catch { return null; }
  if (!s || s.exp < Math.floor(Date.now() / 1000)) return null;
  return { hash, ...s };
}
export const destroySession = (env, hash) => env.SESSIONS.delete("s:" + hash);

// Login nonce, bound into the Google ID token by the frontend (defeats token replay).
// STATELESS: nonce = 22 random chars + 8 hex (expiry, unix seconds) + 32 hex (HMAC). Issuing one costs NO KV write, so bots
// hitting /auth/nonce cannot burn the free KV write budget. Single use is enforced by ONE small KV marker, written only
// after the Google token has been verified (failed or forged logins write nothing).
const NONCE_TTL = 300;
const NONCE_RE = /^[A-Za-z0-9_-]{22}[0-9a-f]{8}[0-9a-f]{32}$/;
const nonceSig = async (env, body) => (await hmacHex("nonce1|" + body, env.GATEWAY_SECRET)).slice(0, 32);

export async function issueNonce(env) {
  const r = randomToken(16), exp = (Math.floor(Date.now() / 1000) + NONCE_TTL).toString(16).padStart(8, "0");
  return r + exp + (await nonceSig(env, r + exp));
}
export async function consumeNonce(env, nonce) {
  if (typeof nonce !== "string" || !NONCE_RE.test(nonce)) return false;
  if (!safeEqual(nonce.slice(30), await nonceSig(env, nonce.slice(0, 30)))) return false; // forged or altered
  const exp = parseInt(nonce.slice(22, 30), 16), now = Math.floor(Date.now() / 1000);
  if (exp < now || exp > now + NONCE_TTL + 60) return false; // expired (or impossibly far in the future)
  const key = "u:" + (await sha256Hex(nonce));
  if (await env.SESSIONS.get(key)) return false; // already used
  await env.SESSIONS.put(key, "1", { expirationTtl: NONCE_TTL + 60 });
  return true;
}
