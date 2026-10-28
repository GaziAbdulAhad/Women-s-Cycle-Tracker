import { requireAuth } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, bn, fmtDate, todayIn, loading, showError, stat, svg } from "../dom.js";
import { loadCycles, loadLogs } from "../data.js";
import { addDays } from "../cycle-engine.js";
import { buildReport, reportCsvRows } from "../report-model.js";
import { toCsv, download } from "../csv.js";
import { FLOW, MOOD, logSummary } from "../text.js";

function chart(points) {
  const W = 600, H = 190, pad = 34, ys = points.map((p) => p.days), lo = Math.min(...ys) - 2, hi = Math.max(...ys) + 2;
  const x = (i) => (points.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (points.length - 1)), y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);
  return svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": "চক্রের দৈর্ঘ্যের ধারা: " + points.map((p) => fmtDate(p.date) + " " + bn(p.days) + " দিন").join(", ") },
    svg("line", { x1: pad, y1: H - pad, x2: W - pad, y2: H - pad, class: "axis" }), svg("line", { x1: pad, y1: pad / 2, x2: pad, y2: H - pad, class: "axis" }),
    svg("text", { x: 4, y: y(hi) + 4, class: "lbl" }, bn(hi)), svg("text", { x: 4, y: y(lo) + 4, class: "lbl" }, bn(lo)),
    svg("polyline", { points: points.map((p, i) => x(i) + "," + y(p.days)).join(" "), class: "line", fill: "none" }),
    ...points.map((p, i) => svg("circle", { cx: x(i), cy: y(p.days), r: 4, class: "dot" })),
    svg("text", { x: pad, y: H - 8, class: "lbl" }, fmtDate(points[0].date)), svg("text", { x: W - pad, y: H - 8, class: "lbl", "text-anchor": "end" }, fmtDate(points[points.length - 1].date)));
}
async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const today = todayIn(s.user && s.user.timezone), root = $("#content");
  $("#from").value = addDays(today, -180); $("#to").value = today; $("#to").max = today;
  let data = null, rep = null;
  async function run() {
    loading(root);
    const from = $("#from").value, to = $("#to").value;
    if (from && to && from > to) return showError(root, new Error("শুরুর তারিখ শেষ তারিখের পরে হতে পারে না।"));
    try {
      if (!data) data = { cycles: await loadCycles(), logs: await loadLogs() };
      rep = buildReport(data.cycles, data.logs, from, to);
      const L = rep.lengthStats, D = rep.durationStats, v = (x, u = " দিন") => (x === null || x === undefined ? "—" : bn(x) + u);
      mount(root,
        h("div", { class: "grid" }, stat("গড় চক্র", L ? v(L.avg) : "—"), stat("ওঠানামা (বড় − ছোট)", v(rep.variability)), stat("গড় মাসিকের সময়", D ? v(D.avg) : "—"), stat("এন্ট্রি (মাসিক / জার্নাল)", bn(rep.cycles.length) + " / " + bn(rep.logs.length))),
        h("div", { class: "card" }, h("h2", {}, "চক্রের দৈর্ঘ্যের ধারা"), rep.lengths.length ? chart(rep.lengths) : h("p", { class: "mute" }, "এই সময়ে চক্রের দৈর্ঘ্য দেখাতে অন্তত দুটি মাসিক লাগবে।")),
        h("div", { class: "card" }, h("h2", {}, "উপসর্গ (কতবার লেখা হয়েছে)"), rep.symptoms.length ? h("table", {}, h("tbody", {}, rep.symptoms.map((x) => h("tr", {}, h("td", {}, x.label), h("td", {}, bn(x.count) + " বার"))))) : h("p", { class: "mute" }, "কোনো উপসর্গ লেখা নেই।")),
        h("div", { class: "card" }, h("h2", {}, "মাসিক"), rep.cycles.length ? h("table", {}, h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "শুরু"), h("th", { scope: "col" }, "শেষ"), h("th", { scope: "col" }, "নোট"))), h("tbody", {}, rep.cycles.map((c) => h("tr", {}, h("td", {}, fmtDate(c.actualStartDate, { year: "numeric" })), h("td", {}, c.actualEndDate ? fmtDate(c.actualEndDate) : "—"), h("td", {}, c.notes))))) : h("p", { class: "mute" }, "এই সময়ে কোনো এন্ট্রি নেই।")),
        h("div", { class: "card" }, h("h2", {}, "দৈনিক জার্নাল"), rep.logs.length ? h("ul", { class: "list" }, rep.logs.map((l) => h("li", {}, h("span", {}, fmtDate(l.date, { year: "numeric" })), h("span", { class: "mute" }, logSummary(l) || "—")))) : h("p", { class: "mute" }, "কোনো জার্নাল নেই।")),
        h("p", { class: "mute" }, "এটি আপনার নিজের লেখা তথ্যের সারাংশ, চিকিৎসা মূল্যায়ন নয়। রিপোর্টে আপনার ব্যক্তিগত স্বাস্থ্যতথ্য আছে; প্রিন্ট বা শেয়ার করার সময় সাবধান থাকুন।"));
    } catch (e) { showError(root, e, run); }
  }
  $("#apply").addEventListener("click", run);
  $("#csv").addEventListener("click", () => { if (rep) download("cycle-report.csv", toCsv(reportCsvRows(rep)), "text/csv;charset=utf-8"); });
  $("#print").addEventListener("click", () => window.print());
  await run();
}
export const ready = main();
