import { requireAuth } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, bn, fmtDate, fmtRange, todayIn, loading, showError, stat, svg } from "../dom.js";
import { api } from "../api.js";
import { loadCycles } from "../data.js";
import { buildModel, modelOptions } from "../calendar-model.js";
import { cycleStats, daysBetween } from "../cycle-engine.js";
import { WARN, PHASE, NOTICE, SOURCE_LABEL, insufficientText, logSummary } from "../text.js";

const recent = (items) => h("div", { class: "card" }, h("h2", {}, "সাম্প্রতিক জার্নাল"),
  items.length ? h("ul", { class: "list" }, items.map((l) => h("li", {}, h("a", { href: "journal.html?date=" + l.date }, fmtDate(l.date)), h("span", { class: "mute" }, logSummary(l) || "—")))) : h("p", { class: "mute" }, "এখনো কোনো জার্নাল নেই।"),
  h("a", { class: "btn alt", href: "journal.html" }, "আজকের জার্নাল লিখুন"));

function ring(day, len) {
  const R = 54, C = 2 * Math.PI * R, f = Math.max(0, Math.min(1, day / len));
  return svg("svg", { viewBox: "0 0 128 128", class: "ring", role: "img", "aria-label": "চক্রের " + bn(day) + " তম দিন" },
    svg("circle", { cx: 64, cy: 64, r: R, class: "bg", fill: "none", "stroke-width": 10 }),
    svg("circle", { cx: 64, cy: 64, r: R, class: "fg", fill: "none", "stroke-width": 10, "stroke-dasharray": (C * f).toFixed(1) + " " + C.toFixed(1), transform: "rotate(-90 64 64)" }),
    svg("text", { x: 64, y: 70, "text-anchor": "middle", class: "ring-t" }, bn(Math.max(day, 0))), svg("text", { x: 64, y: 90, "text-anchor": "middle", class: "ring-s" }, "দিন"));
}

// In-app reminders only: shown on screen while the app is open (no lock-screen or push notifications).
function reminderBanners(rem, m, logs, today) {
  const out = [], by = Object.fromEntries(rem.map((r) => [r.type, r])), p = by.period_upcoming, d = by.daily_log;
  if (p && p.enabled && p.channel === "in_app" && m.analysis) {
    const dl = daysBetween(today, m.analysis.prediction.nextPeriod);
    if (dl >= 0 && dl <= p.daysBefore) out.push(h("div", { class: "notice", role: "status" }, "রিমাইন্ডার: পরবর্তী মাসিক আনুমানিক " + (dl === 0 ? "আজ" : bn(dl) + " দিনের মধ্যে") + "।"));
  }
  if (d && d.enabled && d.channel === "in_app" && !logs.some((l) => l.date === today)) out.push(h("div", { class: "notice", role: "status" }, "রিমাইন্ডার: আজকের জার্নাল এখনো লেখা হয়নি। ", h("a", { href: "journal.html" }, "লিখুন")));
  return out;
}

async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const name = s.user && s.user.displayName;
  $("#greet").textContent = "স্বাগতম" + (name ? ", " + name : "");
  const root = $("#content"); loading(root);
  try {
    const [cycles, logs, rem] = await Promise.all([loadCycles(), api("dailyLogs.list", { limit: 5 }), api("reminders.list")]);
    const today0 = todayIn(s.user && s.user.timezone), m = buildModel(cycles, today0, modelOptions(s.user));
    const banners = reminderBanners(rem.items, m, logs.items, today0);
    if (!m.analysis) {
      mount(root, banners, h("div", { class: "card" }, h("h2", {}, "শুরু করুন"), h("p", {}, m.error ? "মাসিকের তথ্যে সমস্যা আছে। মাসিক এন্ট্রি পেজে দেখুন।" : "আপনার সর্বশেষ মাসিকের প্রথম দিন যোগ করলে এখানে হিসাব দেখা যাবে।"), h("a", { class: "btn", href: "period-entry.html" }, "মাসিক যোগ করুন")), recent(logs.items));
      return;
    }
    const a = m.analysis, p = a.prediction, rg = a.ranges, dl = daysBetween(today0, p.nextPeriod), st = a.stats;
    const notes = [...a.warnings.map((w) => (w === "INSUFFICIENT_DATA" ? insufficientText(a.source, a.cycleLength) : WARN[w])), m.lastPeriodDays > 7 ? WARN.LONG_PERIOD : null, a.ageBand === "u18" ? WARN.TEEN_NOTE : null].filter(Boolean);
    mount(root, banners,
      h("section", { class: "hero-card" }, ring(a.cycleDay, a.cycleLength),
        h("div", {}, h("p", { class: "eyebrow" }, "আজকের অবস্থা"), h("h2", {}, a.cycleDay > 0 ? "চক্রের " + bn(a.cycleDay) + " তম দিন" : "চক্র"),
          h("p", {}, (PHASE[a.phase] || "—") + " ", h("span", { class: "badge est" }, "আনুমানিক")),
          h("p", {}, "পরবর্তী মাসিক: " + fmtDate(p.nextPeriod) + " ", h("span", { class: "badge est" }, "আনুমানিক"), h("br"), (dl >= 0 ? (dl === 0 ? "আজ হতে পারে" : bn(dl) + " দিন বাকি") : bn(-dl) + " দিন দেরি") + " · সম্ভাব্য পরিসর " + fmtRange(rg.nextPeriod.from, rg.nextPeriod.to)),
          h("div", { class: "row" }, h("a", { class: "btn light", href: "period-entry.html" }, "মাসিক যোগ করুন"), h("a", { class: "btn ghost-light", href: "journal.html" }, "আজকের জার্নাল")))),
      notes.map((x) => h("div", { class: "notice", role: "note" }, x)),
      h("div", { class: "grid" },
        stat("সর্বশেষ মাসিক শুরু", fmtDate(a.lastStart, { year: "numeric" }), "act"),
        stat("সম্ভাব্য ডিম্বস্ফোটন", fmtDate(p.ovulation) + " (পরিসর: " + fmtRange(rg.ovulation.from, rg.ovulation.to) + ")", "est"),
        stat("উর্বর সময় (৬ দিন)", fmtRange(p.fertileStart, p.fertileEnd) + " (কম নিশ্চিত পরিসর: " + fmtRange(rg.fertile.from, rg.fertile.to) + ")", "est"),
        stat("ব্যবহৃত চক্র", bn(a.cycleLength) + " দিন (" + SOURCE_LABEL[a.source] + ")", null)),
      h("p", { class: "mute" }, NOTICE),
      h("div", { class: "cols" },
        h("div", { class: "card" }, h("h2", {}, "চক্রের সারসংক্ষেপ"),
          h("p", {}, "ডিম্বস্ফোটন ধরা হয়েছে পরবর্তী মাসিকের " + bn(a.lutealLength) + " দিন আগে।"),
          h("p", {}, "রেকর্ড করা চক্র: " + bn(st.count) + (st.variability !== null ? " · ওঠানামা: " + bn(st.variability) + " দিন" : "")),
          h("div", { class: "row" }, h("a", { class: "btn alt", href: "calendar.html" }, "ক্যালেন্ডার"), h("a", { class: "btn alt", href: "history.html" }, "ইতিহাস"))),
        recent(logs.items)));
  } catch (e) { showError(root, e, main); }
}
export const ready = main();
