// Opaque, revocable sessions in KV. The browser holds a random token; KV holds only its SHA-256 hash.
import { randomToken, sha256Hex } from "./crypto.js";

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

// One-time login nonce, bound into the Google ID token by the frontend (defeats token replay).
export async function issueNonce(env) {
  const nonce = randomToken(24);
  await env.SESSIONS.put("n:" + (await sha256Hex(nonce)), "1", { expirationTtl: 300 });
  return nonce;
}
export async function consumeNonce(env, nonce) {
  if (typeof nonce !== "string" || !/^[A-Za-z0-9_-]{32}$/.test(nonce)) return false;
  const key = "n:" + (await sha256Hex(nonce));
  if (!(await env.SESSIONS.get(key))) return false;
  await env.SESSIONS.delete(key);
  return true;
}
