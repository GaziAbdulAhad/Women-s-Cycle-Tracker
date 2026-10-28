// SecurityService.gs — gateway request authentication.
//
// CONTRACT (Worker -> Apps Script). Apps Script cannot read HTTP headers, so everything is in the body:
//   POST body = {"envelope": "<JSON string>", "sig": "<hex HMAC-SHA256 of the envelope string>"}
//   envelope  = {"v":1,"ts":<unix seconds>,"nonce":"<16-64 chars [A-Za-z0-9_-]>",
//                "action":"cycles.list","identity":{"sub","email","name","picture"},"payload":{}}
// The HMAC is computed over the exact envelope STRING, so no JSON canonicalization problems.
// identity comes ONLY from the Worker, after it verified the Google ID token. Clients never supply it.
// Web app must be deployed "Execute as: Me" + "Anyone" (the Worker cannot log in); the HMAC is the gate.

function hmacHex_(message, secret) {
  const raw = Utilities.computeHmacSha256Signature(message, secret);
  return raw.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

// Constant-time comparison.
function safeEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Replay protection: each nonce is accepted once within the cache TTL.
function claimNonce_(nonce) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    if (cache.get('n:' + nonce)) throw new ApiError('UNAUTHENTICATED', 'Invalid request');
    cache.put('n:' + nonce, '1', CONFIG.NONCE_TTL_SEC);
  } finally {
    lock.releaseLock();
  }
}

// Returns the verified envelope or throws. Fails closed on every check.
function verifyEnvelope_(body) {
  const fail = function () { return new ApiError('UNAUTHENTICATED', 'Invalid request'); };
  if (!body || typeof body.envelope !== 'string' || typeof body.sig !== 'string') throw fail();
  if (!safeEqual_(hmacHex_(body.envelope, getProp_('GATEWAY_SECRET')), body.sig.toLowerCase())) throw fail();
  var env;
  try { env = JSON.parse(body.envelope); } catch (e) { throw fail(); }
  if (!env || env.v !== 1 || typeof env.action !== 'string') throw fail();
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(env.ts) || Math.abs(now - env.ts) > CONFIG.CLOCK_SKEW_SEC) throw fail();
  if (typeof env.nonce !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(env.nonce)) throw fail();
  claimNonce_(env.nonce); // only after the signature is proven valid
  return env;
}

function validateIdentity_(id) {
  if (!id || typeof id.sub !== 'string' || !/^[0-9]{5,40}$/.test(id.sub)) throw new ApiError('UNAUTHENTICATED', 'Invalid request');
  return id;
}
