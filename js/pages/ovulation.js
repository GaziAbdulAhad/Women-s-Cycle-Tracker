import { requireAuth } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, bn, fmtDate, todayIn, loading, showError, stat } from "../dom.js";
import { loadCycles } from "../data.js";
import { buildModel } from "../calendar-model.js";
import { daysBetween } from "../cycle-engine.js";
import { WARN, NOTICE } from "../text.js";

async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const root = $("#content"); loading(root);
  try {
    const m = buildModel(await loadCycles(), todayIn(s.user && s.user.timezone));
    if (!m.analysis) { mount(root, h("div", { class: "card" }, h("p", {}, "হিসাব দেখতে আগে অন্তত একটি মাসিকের প্রথম দিন যোগ করুন।"), h("a", { class: "btn", href: "period-entry.html" }, "মাসিক যোগ করুন"))); return; }
    const a = m.analysis, p = a.prediction, L = a.cycleLength;
    const dFs = daysBetween(a.lastStart, p.fertileStart) + 1, dOv = dFs + 5, dFe = dOv + 1;
    const per = Math.min(m.periodDays, dFs - 1);
    const segs = [["seg-per", per, "মাসিক"], ["seg-fol", dFs - 1 - per, "ফলিকুলার"], ["seg-fer", 5, "উর্বর"], ["seg-ov", 1, "ডিম্বস্ফোটন"], ["seg-fer", 1, "উর্বর"], ["seg-lut", L - dFe, "লুটিয়াল"]].filter(([, n]) => n > 0);
    const bar = h("div", { class: "tl", role: "img", "aria-label": "চক্রের টাইমলাইন: " + segs.map(([, n, t]) => t + " " + bn(n) + " দিন").join(", ") });
    segs.forEach(([c, n]) => { const sp = h("span", { class: c }); sp.style.flex = String(n); bar.append(sp); });
    mount(root,
      a.warnings.map((w) => h("div", { class: "notice", role: "note" }, WARN[w])),
      h("div", { class: "grid" }, stat("সম্ভাব্য ডিম্বস্ফোটন", fmtDate(p.ovulation, { year: "numeric" }), "est"), stat("উর্বর সময়ের শুরু", fmtDate(p.fertileStart), "est"), stat("উর্বর সময়ের শেষ", fmtDate(p.fertileEnd), "est"), stat("পরবর্তী মাসিক", fmtDate(p.nextPeriod, { year: "numeric" }), "est")),
      h("div", { class: "notice", role: "note" }, NOTICE),
      h("div", { class: "card" }, h("h2", {}, "বর্তমান চক্রের টাইমলাইন (" + bn(L) + " দিন)"), bar,
        h("p", { class: "mute" }, "মাসিক · ফলিকুলার · উর্বর সময় · ডিম্বস্ফোটন (" + bn(dOv) + " তম দিন) · লুটিয়াল"),
        h("p", {}, "হিসাবের নিয়ম: ডিম্বস্ফোটন ≈ পরবর্তী মাসিকের ১৪ দিন আগে; উর্বর সময় ≈ ডিম্বস্ফোটনের ৫ দিন আগে থেকে ১ দিন পর পর্যন্ত। চক্রের দৈর্ঘ্য " + (a.source === "history" ? "আপনার আগের চক্রগুলোর গড় থেকে" : "ডিফল্ট (২৮ দিন) ধরে") + " নেওয়া হয়েছে।")));
  } catch (e) { showError(root, e, main); }
}
export const ready = main();
