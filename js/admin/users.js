import { initAdmin, SA } from "./admin-shell.js";
import { h, $, mount, fmtDate, loading, showError, say } from "../dom.js";
import { api } from "../api.js";
async function main() {
  if (!(await initAdmin(SA))) return;
  const root = $("#content"), msg = $("#msg"); let items = [], total = 0, next = null;
  async function load(more) {
    if (!more) { items = []; loading(root); }
    try { const r = await api("admin.listUsers", { limit: 50, offset: more ? next : 0 }); items.push(...r.items); total = r.total; next = r.nextOffset; draw(); } catch (e) { showError(root, e, () => load(more)); }
  }
  async function setStatus(u, status) {
    if (!confirm((status === "suspended" ? "এই অ্যাকাউন্ট সাময়িক বন্ধ করবেন? " : "এই অ্যাকাউন্ট আবার চালু করবেন? ") + u.email)) return;
    try { await api("admin.updateUserStatus", { userId: u.userId, status }); say(msg, "হালনাগাদ হয়েছে।"); await load(false); } catch (e) { say(msg, e.message, "err"); }
  }
  function draw() {
    mount(root, h("p", { class: "mute" }, "মোট " + total + " জন। এখানে শুধু অ্যাকাউন্টের তথ্য দেখা যায়, স্বাস্থ্যতথ্য নয়।"),
      h("div", { class: "card" }, h("table", {}, h("thead", {}, h("tr", {}, ["নাম", "ইমেইল", "অবস্থা", "খোলা হয়েছে", ""].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", {}, items.map((u) => h("tr", {}, h("td", {}, u.displayName), h("td", {}, u.email), h("td", {}, u.status === "active" ? "সচল" : "সাময়িক বন্ধ"), h("td", {}, fmtDate(String(u.createdAt).slice(0, 10), { year: "numeric" })),
          h("td", {}, h("button", { class: "btn " + (u.status === "active" ? "danger" : "alt"), type: "button", onclick: () => setStatus(u, u.status === "active" ? "suspended" : "active") }, u.status === "active" ? "বন্ধ করুন" : "চালু করুন"))))))),
      next !== null ? h("button", { class: "btn alt", type: "button", onclick: () => load(true) }, "আরও দেখান") : null);
  }
  await load(false);
}
export const ready = main();
