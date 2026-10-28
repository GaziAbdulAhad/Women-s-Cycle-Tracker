// Verifies a Google Sign-In ID token the supported way: RS256 signature against Google's published keys (JWKS),
// then issuer, audience, expiry, freshness, verified email. NOT the tokeninfo endpoint.
import { b64urlToBytes } from "./crypto.js";

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const MAX_TOKEN_AGE_SEC = 600; // login needs a freshly issued token (limits stolen-token reuse)
const SKEW_SEC = 60;
const dec = new TextDecoder();

export class AuthError extends Error {
  constructor(reason) { super("Sign-in failed"); this.reason = reason; } // reason is for server logs only
}

async function loadKey(kid, fresh) {
  const res = await fetch(JWKS_URL, { cf: { cacheTtl: fresh ? 0 : 3600, cacheEverything: true } });
  if (!res.ok) throw new AuthError("jwks_unavailable");
  const jwk = ((await res.json()).keys || []).find((k) => k.kid === kid && k.kty === "RSA");
  if (!jwk) return null;
  return crypto.subtle.importKey("jwk", { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}

export async function verifyGoogleIdToken(token, { clientId, now = Math.floor(Date.now() / 1000) }) {
  if (typeof token !== "string" || token.length > 4096) throw new AuthError("missing_token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new AuthError("malformed");
  let header, claims;
  try {
    header = JSON.parse(dec.decode(b64urlToBytes(parts[0])));
    claims = JSON.parse(dec.decode(b64urlToBytes(parts[1])));
  } catch { throw new AuthError("malformed"); }
  // Pin the algorithm: rejects "none" and HS256 key-confusion tricks.
  if (!header || header.alg !== "RS256" || typeof header.kid !== "string") throw new AuthError("bad_alg");
  const key = (await loadKey(header.kid, false)) || (await loadKey(header.kid, true)); // 2nd try handles key rotation
  if (!key) throw new AuthError("unknown_kid");
  let ok = false;
  try {
    ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
  } catch { ok = false; }
  if (!ok) throw new AuthError("bad_signature");
  if (!claims || !ISSUERS.includes(claims.iss)) throw new AuthError("bad_issuer");
  if (claims.aud !== clientId) throw new AuthError("bad_audience");
  if (!Number.isInteger(claims.exp) || claims.exp <= now - SKEW_SEC) throw new AuthError("expired");
  if (!Number.isInteger(claims.iat) || claims.iat > now + SKEW_SEC || claims.iat < now - MAX_TOKEN_AGE_SEC) throw new AuthError("stale_token");
  if (typeof claims.sub !== "string" || !/^[0-9]{5,40}$/.test(claims.sub)) throw new AuthError("bad_sub");
  if (typeof claims.email !== "string" || claims.email_verified !== true) throw new AuthError("email_unverified");
  return claims;
}
