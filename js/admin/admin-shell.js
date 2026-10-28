// Admin UI shell. This is only a UI guard: every admin API call is authorised again by Apps Script from the AdminRoles sheet.
import { requireAuth } from "../auth.js";
import { api, logout } from "../api.js";
import { h, $, mount } from "../dom.js";

export const SA = ["super_admin", "support_admin"], CE = ["content_editor", "super_admin"], SU = ["super_admin"];
const NAV = [["index.html", "সারসংক্ষেপ", SA], ["users.html", "ব্যবহারকারী", SA], ["content.html", "কনটেন্ট", CE], ["reports.html", "রিপোর্ট", SA], ["audit-logs.html", "অডিট লগ", SU], ["settings.html", "সেটিংস", SU]];
const ROLE = { super_admin: "সুপার অ্যাডমিন", support_admin: "সাপোর্ট অ্যাডমিন", content_editor: "কনটেন্ট এডিটর" };

export async function initAdmin(allowed) {
  const s = requireAuth(); if (!s) return null;
  const page = location.pathname.split("/").pop();
  let role = null;
  try { role = (await api("admin.whoami")).role; } catch (e) { mount($("#content"), h("div", { class: "notice err", role: "alert" }, e.message)); return null; }
  mount($("#site-header"), h("div", { class: "bar" }, h("a", { class: "brand", href: "index.html" }, "চক্র অ্যাডমিন"),
    h("nav", { class: "nav", "aria-label": "অ্যাডমিন মেনু" }, NAV.filter(([, , r]) => role && r.includes(role)).map(([href, label]) => h("a", { href, "aria-current": href === page ? "page" : null }, label))),
    h("div", { class: "who" }, role ? h("span", { class: "badge" }, ROLE[role]) : null, h("a", { href: "../dashboard.html" }, "অ্যাপে ফিরুন"), h("button", { class: "btn alt", type: "button", onclick: async () => { await logout(); location.replace("../index.html"); } }, "সাইন আউট"))));
  mount($("#site-footer"), h("p", {}, "অ্যাডমিনরা ব্যবহারকারীর মাসিক, জার্নাল বা উপসর্গ দেখতে পারেন না। প্রতিটি অ্যাডমিন কাজ অডিট লগে থাকে।"));
  if (!role || !allowed.includes(role)) { mount($("#content"), h("div", { class: "notice err", role: "alert" }, "এই পেজে আপনার প্রবেশাধিকার নেই।")); return null; }
  return role;
}
