// DOM helpers. Everything is built with createElement and textContent, never HTML strings, so user text cannot become markup.
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids.flat(Infinity)) if (c !== undefined && c !== null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
export const $ = (s, r = document) => r.querySelector(s);
export const mount = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
export const bn = (n) => Number(n).toLocaleString("bn-BD", { useGrouping: false });
export const fmtDate = (iso, o = {}) => new Date(iso + "T12:00:00Z").toLocaleDateString("bn-BD", { timeZone: "UTC", day: "numeric", month: "long", ...o });
export function todayIn(tz) {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); } catch { return new Intl.DateTimeFormat("en-CA").format(new Date()); }
}
export const isIso = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const loading = (el) => mount(el, h("p", { class: "mute", role: "status" }, "লোড হচ্ছে…"));
export function showError(el, err, retry) {
  mount(el, h("div", { class: "notice err", role: "alert" }, h("p", {}, (err && err.message) || "কিছু ভুল হয়েছে।"), retry ? h("button", { class: "btn alt", type: "button", onclick: retry }, "আবার চেষ্টা করুন") : null));
}
export function say(el, msg, kind = "ok") { mount(el, msg ? h("span", { class: "notice " + kind }, msg) : null); }
export function stat(label, value, kind) {
  return h("div", { class: "card stat" }, h("span", { class: "mute" }, label), h("strong", {}, value),
    kind ? h("span", { class: "badge " + kind }, kind === "est" ? "আনুমানিক" : "প্রকৃত") : null);
}
export function svg(tag, attrs = {}, ...kids) {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  for (const c of kids) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
