import { requireAuth } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, bn, fmtDate, todayIn, isIso, loading, showError, say } from "../dom.js";
import { api } from "../api.js";
import { loadCycles } from "../data.js";
import { daysBetween } from "../cycle-engine.js";

async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const today = todayIn(s.user && s.user.timezone); let editing = null;
  $("#start").max = $("#end").max = today;
  const q = new URLSearchParams(location.search).get("date");
  if (isIso(q) && q <= today) $("#start").value = q;
  const msg = $("#msg"), list = $("#list");
  const reset = () => { editing = null; $("#pform").reset(); $("#saveBtn").textContent = "সেভ করুন"; $("#cancelBtn").hidden = true; };
  async function refresh() {
    loading(list);
    try {
      const cycles = await loadCycles();
      mount(list, cycles.length ? h("ul", { class: "list" }, cycles.map((c) => h("li", {},
        h("span", {}, fmtDate(c.actualStartDate, { year: "numeric" }) + (c.actualEndDate ? " – " + fmtDate(c.actualEndDate) + " (" + bn(daysBetween(c.actualStartDate, c.actualEndDate) + 1) + " দিন)" : " – শেষ দিন দেওয়া নেই"), c.notes ? h("br") : null, c.notes ? h("small", { class: "mute" }, c.notes) : null),
        h("span", { class: "row" },
          h("button", { class: "btn alt", type: "button", onclick: () => { editing = c.cycleId; $("#start").value = c.actualStartDate; $("#end").value = c.actualEndDate; $("#notes").value = c.notes; $("#saveBtn").textContent = "পরিবর্তন সেভ করুন"; $("#cancelBtn").hidden = false; $("#start").focus(); } }, "সম্পাদনা"),
          h("button", { class: "btn danger", type: "button", onclick: async () => { if (!confirm("এই মাসিকের এন্ট্রি মুছে ফেলবেন?")) return; try { await api("cycles.delete", { cycleId: c.cycleId }); say(msg, "মুছে ফেলা হয়েছে।"); if (editing === c.cycleId) reset(); await refresh(); } catch (e) { say(msg, e.message, "err"); } } }, "মুছুন"))))) : h("p", { class: "mute" }, "এখনো কোনো মাসিক লগ করা হয়নি।"));
    } catch (e) { showError(list, e, refresh); }
  }
  $("#cancelBtn").addEventListener("click", () => { reset(); say(msg, ""); });
  $("#pform").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const start = $("#start").value, end = $("#end").value;
    if (!start) return say(msg, "মাসিকের প্রথম দিনের তারিখ দিন।", "err");
    if (start > today) return say(msg, "ভবিষ্যতের তারিখ দেওয়া যাবে না।", "err");
    if (end && end < start) return say(msg, "শেষ দিন প্রথম দিনের আগে হতে পারে না।", "err");
    const payload = { actualStartDate: start, actualEndDate: end, notes: $("#notes").value };
    $("#saveBtn").disabled = true;
    try { await api(editing ? "cycles.update" : "cycles.create", editing ? { cycleId: editing, ...payload } : payload); reset(); say(msg, "সেভ হয়েছে। পূর্বাভাস নতুন তথ্য দিয়ে আবার হিসাব হবে।"); await refresh(); }
    catch (e) { say(msg, e.message, "err"); }
    $("#saveBtn").disabled = false;
  });
  await refresh();
}
export const ready = main();
