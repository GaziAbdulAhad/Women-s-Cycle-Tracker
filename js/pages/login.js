// Used by login.html and register.html (body[data-mode]). Official Google Identity Services only; no passwords handled.
// After sign-in the server-side consent record decides whether the user must accept the current policy version.
import { CONFIG, isConfigured, POLICY_VERSION, CONSENT_TYPES } from "../config.js";
import { initShell } from "../shell.js";
import { h, $, mount } from "../dom.js";
import { getSession, saveSession, clearSession, safeNext } from "../auth.js";
import { api, fetchNonce, loginWithGoogle } from "../api.js";

const notice = (t, k = "err") => h("div", { class: "notice " + k, role: "alert" }, t);
const hasAll = (items) => CONSENT_TYPES.every((t) => items.some((i) => i.consentType === t && i.policyVersion === POLICY_VERSION && !i.withdrawnAt));
const recordConsent = () => api("consents.record", { policyVersion: POLICY_VERSION, consentTypes: CONSENT_TYPES });
const googleReady = () => new Promise((resolve, reject) => {
  if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
  const t = setTimeout(() => reject(new Error("Google Sign-In লোড হয়নি। ইন্টারনেট বা অ্যাড-ব্লকার দেখুন।")), 10000);
  $("#gsi").addEventListener("load", () => { clearTimeout(t); resolve(); });
});
async function main() {
  initShell({ isPrivate: false });
  const msg = $("#msg"), box = $("#gsi-btn"), next = safeNext(new URLSearchParams(location.search).get("next"));
  const register = document.body.dataset.mode === "register", agree = $("#agree");
  const existing = getSession();
  if (existing) {
    if (existing.consentOk) { location.replace(next); return; }
    if (!register) { location.replace("register.html?next=" + encodeURIComponent(next)); return; }
    // Signed in, but the current policy version has not been accepted yet: consent only, no new sign-in.
    box.hidden = true; const btn = $("#consentBtn"); btn.hidden = false;
    mount(msg, h("div", { class: "notice", role: "note" }, "চালিয়ে যেতে নিচের শর্তে সম্মতি দিন।"));
    btn.addEventListener("click", async () => {
      if (!agree.checked) return mount(msg, notice("সম্মতির বাক্সে টিক দিন।"));
      try { await recordConsent(); saveSession({ ...existing, consentOk: true }); location.replace(next); } catch (e) { mount(msg, notice(e.message)); }
    });
    return;
  }
  if (!isConfigured()) { mount(msg, notice("সেটআপ বাকি: js/config.js-এ API_BASE_URL ও GOOGLE_CLIENT_ID বসান।")); return; }
  let busy = false;
  async function onCredential(resp) {
    busy = true; mount(msg, h("p", { class: "mute", role: "status" }, "সাইন ইন হচ্ছে…"));
    try {
      const d = await loginWithGoogle(resp.credential);
      saveSession({ token: d.session, expiresAt: d.expiresAt, user: d.user, consentOk: false });
      let ok = hasAll((await api("consents.list")).items);
      if (!ok && register && agree.checked) { await recordConsent(); ok = true; }
      if (ok) saveSession({ token: d.session, expiresAt: d.expiresAt, user: d.user, consentOk: true });
      location.replace(ok ? next : "register.html?next=" + encodeURIComponent(next)); return;
    } catch (e) { clearSession(); mount(msg, notice(e.message)); }
    busy = false; await setup(); // the nonce is single-use, so fetch a fresh one
  }
  async function setup() {
    try {
      const nonce = await fetchNonce(); await googleReady();
      window.google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: onCredential, nonce, ux_mode: "popup", auto_select: false });
      box.replaceChildren();
      window.google.accounts.id.renderButton(box, { theme: "outline", size: "large", text: register ? "signup_with" : "signin_with", locale: "bn", width: 280 });
    } catch (e) { mount(msg, notice(e.message || "সেটআপ করা যায়নি।")); }
  }
  if (register) { box.hidden = !agree.checked; agree.addEventListener("change", () => { box.hidden = !agree.checked; }); }
  await setup();
  setInterval(() => { if (!busy && !document.hidden) setup(); }, 240000); // keep the one-time nonce fresh (it expires after 5 min)
}
export const ready = main();
