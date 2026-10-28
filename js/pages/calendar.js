import { requireAuth } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, bn, fmtDate, todayIn, showError } from "../dom.js";
import { loadCycles, loadLogs } from "../data.js";
import { buildModel, dayInfo } from "../calendar-model.js";
import { addDays } from "../cycle-engine.js";
import { logSummary } from "../text.js";

const DOW = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"];
const dow = (iso) => new Date(iso + "T12:00:00Z").getUTCDay();
const monthLast = (iso) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7), 0)).toISOString().slice(0, 10);

async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const today = todayIn(s.user && s.user.timezone), st = { view: "month", cursor: today, sel: today }, logs = new Map(), loaded = new Set();
  let model;
  try { model = buildModel(await loadCycles(), today); } catch (e) { showError($("#err"), e, main); return; }

  function range() {
    if (st.view === "week") { const a = addDays(st.cursor, -dow(st.cursor)); return [a, addDays(a, 6)]; }
    const f = st.cursor.slice(0, 8) + "01", l = monthLast(f);
    return [addDays(f, -dow(f)), addDays(l, 6 - dow(l))];
  }
  async function render() {
    const [a, z] = range(), key = a + z;
    if (!loaded.has(key)) { try { (await loadLogs(a, z)).forEach((l) => logs.set(l.date, l)); loaded.add(key); } catch (e) { showError($("#err"), e, render); return; } }
    mount($("#err"));
    $("#cal-title").textContent = st.view === "week" ? fmtDate(a) + " – " + fmtDate(z) : new Date(st.cursor + "T12:00:00Z").toLocaleDateString("bn-BD", { timeZone: "UTC", month: "long", year: "numeric" });
    $("#viewBtn").textContent = st.view === "week" ? "মাসিক ভিউ" : "সাপ্তাহিক ভিউ";
    const cells = DOW.map((d) => h("div", { class: "dow" }, d));
    for (let d = a; d <= z; d = addDays(d, 1)) {
      const i = dayInfo(d, model), parts = [], marks = [];
      if (i.actual) { parts.push("প্রকৃত মাসিক"); marks.push("●"); }
      if (i.predictedPeriod) { parts.push("সম্ভাব্য মাসিক (আনুমানিক)"); marks.push("○"); }
      if (i.fertile) { parts.push("উর্বর সময় (আনুমানিক)"); marks.push("~"); }
      if (i.ovulation) { parts.push("সম্ভাব্য ডিম্বস্ফোটন (আনুমানিক)"); marks.push("★"); }
      if (logs.has(d)) { parts.push("জার্নাল আছে"); marks.push("✎"); }
      const cls = ["cell", i.actual && "is-per", i.predictedPeriod && "is-pp", i.fertile && "is-fer", i.ovulation && "is-ov", d === today && "today", d === st.sel && "sel", st.view === "month" && d.slice(0, 7) !== st.cursor.slice(0, 7) && "out"].filter(Boolean).join(" ");
      cells.push(h("button", { type: "button", class: cls, "aria-pressed": String(d === st.sel), "aria-label": fmtDate(d, { year: "numeric" }) + (parts.length ? ": " + parts.join(", ") : ""), onclick: () => { st.sel = d; render(); } }, h("span", {}, bn(+d.slice(8))), h("small", {}, marks.join(" "))));
    }
    mount($("#cal"), cells);
    const i = dayInfo(st.sel, model), l = logs.get(st.sel), lines = [];
    if (i.actual) lines.push("প্রকৃত মাসিক (আপনার লগ করা তথ্য)");
    if (i.predictedPeriod) lines.push("সম্ভাব্য মাসিক — আনুমানিক");
    if (i.fertile) lines.push("উর্বর সময় — আনুমানিক");
    if (i.ovulation) lines.push("সম্ভাব্য ডিম্বস্ফোটন — আনুমানিক");
    mount($("#details"), h("h2", {}, fmtDate(st.sel, { year: "numeric" })), lines.length ? h("ul", {}, lines.map((x) => h("li", {}, x))) : h("p", { class: "mute" }, "এই দিনে কোনো চিহ্ন নেই।"),
      l ? h("p", {}, "জার্নাল: " + (logSummary(l) || "—")) : null,
      h("div", { class: "row" }, h("a", { class: "btn", href: "journal.html?date=" + st.sel }, l ? "জার্নাল সম্পাদনা" : "জার্নাল লিখুন"), st.sel <= today ? h("a", { class: "btn alt", href: "period-entry.html?date=" + st.sel }, "এই দিন মাসিক শুরু") : null));
  }
  const shift = (n) => { st.cursor = st.view === "week" ? addDays(st.cursor, 7 * n) : new Date(Date.UTC(+st.cursor.slice(0, 4), +st.cursor.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 10); render(); };
  $("#prev").addEventListener("click", () => shift(-1));
  $("#next").addEventListener("click", () => shift(1));
  $("#todayBtn").addEventListener("click", () => { st.cursor = st.sel = today; render(); });
  $("#viewBtn").addEventListener("click", () => { st.view = st.view === "week" ? "month" : "week"; render(); });
  await render();
}
export const ready = main();
