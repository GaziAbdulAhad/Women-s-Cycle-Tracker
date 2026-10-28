import { initAdmin, SA } from "./admin-shell.js";
import { h, $, mount, bn, loading, showError, stat } from "../dom.js";
import { api } from "../api.js";
async function main() {
  if (!(await initAdmin(SA))) return;
  const root = $("#content"); loading(root);
  try {
    const d = await api("admin.getSummary"), a = d.accounts, u = d.usage, hl = d.health;
    mount(root, hl.maintenanceMode ? h("div", { class: "notice", role: "status" }, "রক্ষণাবেক্ষণ মোড চালু: সাধারণ ব্যবহারকারীরা ঢুকতে পারছেন না।") : null,
      h("div", { class: "grid" }, stat("মোট অ্যাকাউন্ট", bn(a.total)), stat("সচল", bn(a.active)), stat("সাময়িক বন্ধ", bn(a.suspended)), stat("নতুন (৭ দিন)", bn(a.new7d)), stat("নতুন (৩০ দিন)", bn(a.new30d))),
      h("div", { class: "cols" }, h("div", { class: "card" }, h("h2", {}, "ব্যবহার (শুধু সংখ্যা)"), h("p", {}, "মাসিকের রেকর্ড: " + bn(u.cycleRecords)), h("p", {}, "জার্নাল এন্ট্রি: " + bn(u.dailyLogs)), h("p", {}, "রিমাইন্ডার নিয়ম: " + bn(u.reminderRules))),
        h("div", { class: "card" }, h("h2", {}, "সিস্টেম"), h("p", {}, "সার্ভারের সময়: " + hl.serverTime), h("p", {}, "Sheet-এর সারি: " + Object.entries(hl.sheetRows).map(([k, v]) => k + " " + bn(v)).join(", ")))));
  } catch (e) { showError(root, e, main); }
}
export const ready = main();
