// Session lives in sessionStorage: survives page navigation in this tab, gone when the tab closes.
// Trade-off: any XSS could read it — hence the strict CSP on every page and no HTML-string injection anywhere.
const KEY = "wht.session";
const PAGES = new Set(["dashboard.html", "calendar.html", "period-entry.html", "ovulation.html", "journal.html", "history.html", "settings.html", "account.html", "reminders.html", "reports.html", "learn.html",
  "admin/index.html", "admin/users.html", "admin/content.html", "admin/reports.html", "admin/audit-logs.html", "admin/settings.html"]);
export function getSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (!s || typeof s.token !== "string" || s.expiresAt * 1000 < Date.now()) { sessionStorage.removeItem(KEY); return null; }
    return s;
  } catch { return null; }
}
export const saveSession = (s) => sessionStorage.setItem(KEY, JSON.stringify(s));
export const clearSession = () => sessionStorage.removeItem(KEY);
export function updateUser(user) { const s = getSession(); if (s) saveSession({ ...s, user }); }
// Only known same-site pages are allowed as redirect targets (no open redirect).
export const safeNext = (v) => (PAGES.has(v) ? v : "dashboard.html");
export const currentPage = () => location.pathname.split("/").pop() || "index.html";
const inAdmin = () => location.pathname.includes("/admin/");
const up = () => (inAdmin() ? "../" : "");
const pagePath = () => (inAdmin() ? "admin/" : "") + currentPage();
export const goLogin = () => location.replace(up() + "login.html?next=" + encodeURIComponent(pagePath()));
// UI guard only. Real authorization is enforced by the Worker and Apps Script.
// consentOk is set by the sign-in flow after the server confirms the current policy version was accepted.
export function requireAuth() {
  const s = getSession();
  if (!s) { goLogin(); return null; }
  if (!s.consentOk) { location.replace(up() + "register.html?next=" + encodeURIComponent(pagePath())); return null; }
  return s;
}
