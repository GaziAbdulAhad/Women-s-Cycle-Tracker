import { requireAuth } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, bn, fmtDate, loading, showError, stat } from "../dom.js";
import { loadCycles } from "../data.js";
import { cycleStats, cycleLengths, daysBetween, LIMITS } from "../cycle-engine.js";
import { WARN } from "../text.js";

async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const root = $("#content"); loading(root);
  try {
    const cycles = await loadCycles(), asc = [...cycles].sort((a, b) => (a.actualStartDate < b.actualStartDate ? -1 : 1));
    if (!asc.length) { mount(root, h("div", { class: "card" }, h("p", {}, "এখনো কোনো মাসিক লগ করা হয়নি।"), h("a", { class: "btn", href: "period-entry.html" }, "মাসিক যোগ করুন"))); return; }
    const starts = asc.map((c) => c.actualStartDate), st = cycleStats(starts), lens = cycleLengths(starts).slice(-12), max = Math.max(1, ...lens);
    const v = (x) => (x === null ? "—" : bn(x) + " দিন");
    mount(root,
      st.variability !== null && st.variability > LIMITS.irregularRange ? h("div", { class: "notice", role: "note" }, WARN.IRREGULAR_CYCLES) : null,
      h("div", { class: "grid" }, stat("গড় চক্র", v(st.average)), stat("সবচেয়ে ছোট", v(st.min)), stat("সবচেয়ে বড়", v(st.max)), stat("ওঠানামা (বড় − ছোট)", v(st.variability)), stat("রেকর্ড করা মাসিক", bn(cycles.length))),
      h("div", { class: "card" }, h("h2", {}, "সাম্প্রতিক চক্রের দৈর্ঘ্য"), lens.length ? lens.map((n) => { const b = h("div", { class: "b" }); b.style.width = Math.round((n / max) * 100) + "%"; return h("div", { class: "bar-row" }, h("span", { class: "mute" }, bn(n) + " দিন"), b); }) : h("p", { class: "mute" }, "চক্রের দৈর্ঘ্য দেখতে অন্তত দুটি মাসিক লগ করুন।")),
      h("div", { class: "card" }, h("h2", {}, "সব মাসিক"), h("div", { style: null }, h("table", {}, h("thead", {}, h("tr", {}, ["শুরু", "মাসিকের সময়", "চক্রের দৈর্ঘ্য"].map((t) => h("th", { scope: "col" }, t)))),
        h("tbody", {}, [...asc].reverse().map((c) => { const i = asc.indexOf(c), nx = asc[i + 1]; return h("tr", {}, h("td", {}, fmtDate(c.actualStartDate, { year: "numeric" })), h("td", {}, c.actualEndDate ? bn(daysBetween(c.actualStartDate, c.actualEndDate) + 1) + " দিন" : "—"), h("td", {}, nx ? bn(daysBetween(c.actualStartDate, nx.actualStartDate)) + " দিন" : "চলমান")); }))))));
  } catch (e) { showError(root, e, main); }
}
export const ready = main();
