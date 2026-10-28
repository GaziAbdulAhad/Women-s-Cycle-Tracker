import { CONFIG } from "./config.js";
import { getSession, clearSession, goLogin } from "./auth.js";

export class ApiError extends Error { constructor(code, message, status) { super(message); this.code = code; this.status = status; } }
const MSG = {
  NETWORK: "সার্ভারে সংযোগ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।", UNAUTHENTICATED: "আবার সাইন ইন করুন।", RATE_LIMITED: "অনেক বেশি অনুরোধ হয়েছে। একটু পরে চেষ্টা করুন।",
  ACCOUNT_DISABLED: "এই অ্যাকাউন্টটি এখন সচল নয়।", UPSTREAM_ERROR: "সেবাটি সাময়িকভাবে পাওয়া যাচ্ছে না। একটু পরে চেষ্টা করুন।", NOT_FOUND: "তথ্যটি পাওয়া যায়নি।", FORBIDDEN_ORIGIN: "এই ওয়েবসাইটের ঠিকানা অনুমোদিত নয়।",
};
async function http(path, { method = "POST", body, token } = {}) {
  let res;
  try {
    res = await fetch(CONFIG.API_BASE_URL + path, { method, cache: "no-store", credentials: "omit",
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: "Bearer " + token } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch { throw new ApiError("NETWORK", MSG.NETWORK, 0); }
  let out = null; try { out = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || !out || out.ok !== true) {
    const code = (out && out.error && out.error.code) || "ERROR";
    const detail = out && out.error && out.error.message;
    const msg = MSG[code] || (code === "VALIDATION_ERROR" || code === "CONFLICT" ? "তথ্য গ্রহণ করা যায়নি: " + detail : "কিছু ভুল হয়েছে। আবার চেষ্টা করুন।");
    throw new ApiError(code, msg, res.status);
  }
  return out.data;
}
export async function api(action, payload = {}) {
  const s = getSession();
  if (!s) { goLogin(); throw new ApiError("UNAUTHENTICATED", MSG.UNAUTHENTICATED, 401); }
  try { return await http("/api", { body: { action, payload }, token: s.token }); }
  catch (e) { if (e.status === 401 || e.code === "ACCOUNT_DISABLED") { clearSession(); goLogin(); } throw e; }
}
export const fetchNonce = async () => (await http("/auth/nonce", { method: "GET" })).nonce;
export const loginWithGoogle = (credential) => http("/auth/login", { body: { credential } });
export async function logout() {
  const s = getSession(); clearSession();
  if (s) { try { await http("/auth/logout", { body: {}, token: s.token }); } catch { /* session expires on its own */ } }
}
