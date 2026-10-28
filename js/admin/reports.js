import { initAdmin, SA } from "./admin-shell.js";
import { h, $, mount, bn, fmtDate, loading, showError } from "../dom.js";
import { api } from "../api.js";
async function main() {
  if (!(await initAdmin(SA))) return;
  const root = $("#content"); loading(root);
  try {
    const d = await api("admin.getSummary"), max = Math.max(1, ...d.signupsByDay.map((x) => x.count));
    mount(root, h("div", { class: "card" }, h("h2", {}, "নতুন অ্যাকাউন্ট (গত ১৪ দিন)"), d.signupsByDay.map((x) => { const b = h("div", { class: "b" }); b.style.width = Math.round((x.count / max) * 100) + "%"; return h("div", { class: "bar-row" }, h("span", { class: "mute" }, fmtDate(x.date) + ": " + bn(x.count)), b); })),
      h("div", { class: "card" }, h("h2", {}, "গোপনীয়তা অনুরোধ (গত ৩০ দিন)"), h("p", {}, "তথ্য ডাউনলোড: " + bn(d.privacyRequests30d.exports)), h("p", {}, "অ্যাকাউন্ট মুছে ফেলা: " + bn(d.privacyRequests30d.deletions)), h("p", { class: "mute" }, "অনুরোধগুলো ব্যবহারকারী নিজেই করেন এবং সঙ্গে সঙ্গে সম্পন্ন হয়; এখানে শুধু সংখ্যা দেখানো হয়।")),
      h("div", { class: "card" }, h("h2", {}, "ব্যবহারের সংখ্যা"), h("p", {}, "অ্যাকাউন্ট: " + bn(d.accounts.total) + " · মাসিকের রেকর্ড: " + bn(d.usage.cycleRecords) + " · জার্নাল: " + bn(d.usage.dailyLogs) + " · রিমাইন্ডার নিয়ম: " + bn(d.usage.reminderRules))));
  } catch (e) { showError(root, e, main); }
}
export const ready = main();
