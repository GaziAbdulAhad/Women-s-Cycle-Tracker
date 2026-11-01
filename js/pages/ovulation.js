import { requireAuth } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, bn, fmtDate, fmtRange, todayIn, loading, showError, stat } from "../dom.js";
import { loadCycles } from "../data.js";
import { buildModel, modelOptions } from "../calendar-model.js";
import { daysBetween } from "../cycle-engine.js";
import { WARN, NOTICE, SOURCE_LABEL, insufficientText } from "../text.js";

async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const root = $("#content"); loading(root);
  try {
    const today = todayIn(s.user && s.user.timezone), m = buildModel(await loadCycles(), today, modelOptions(s.user));
    if (!m.analysis) { mount(root, h("div", { class: "card" }, h("p", {}, "হিসাব দেখতে আগে অন্তত একটি মাসিকের প্রথম দিন যোগ করুন।"), h("a", { class: "btn", href: "period-entry.html" }, "মাসিক যোগ করুন"))); return; }
    const a = m.analysis, p = a.prediction, rg = a.ranges, L = a.cycleLength;
    const dFs = daysBetween(a.lastStart, p.fertileStart) + 1, dOv = dFs + 5, per = Math.min(m.periodDays, dFs - 1);
    const segs = [["seg-per", per, "মাসিক"], ["seg-fol", dFs - 1 - per, "ফলিকুলার"], ["seg-fer", 5, "উর্বর"], ["seg-ov", 1, "ডিম্বস্ফোটন"], ["seg-lut", L - dOv, "লুটিয়াল"]].filter(([, n]) => n > 0);
    const bar = h("div", { class: "tl", role: "img", "aria-label": "চক্রের টাইমলাইন: " + segs.map(([, n, t]) => t + " " + bn(n) + " দিন").join(", ") });
    segs.forEach(([c, n]) => { const sp = h("span", { class: c }); sp.style.flex = String(n); bar.append(sp); });
    const notes = [...a.warnings.map((w) => (w === "INSUFFICIENT_DATA" ? insufficientText(a.source, L) : WARN[w])), a.ageBand === "u18" ? WARN.TEEN_NOTE : null].filter(Boolean);
    mount(root,
      notes.map((x) => h("div", { class: "notice", role: "note" }, x)),
      h("div", { class: "grid" }, stat("সম্ভাব্য ডিম্বস্ফোটন", fmtDate(p.ovulation, { year: "numeric" }), "est"), stat("ডিম্বস্ফোটনের সম্ভাব্য পরিসর", fmtRange(rg.ovulation.from, rg.ovulation.to), "est"),
        stat("উর্বর সময় (৬ দিন)", fmtRange(p.fertileStart, p.fertileEnd), "est"), stat("কম নিশ্চিত বড় পরিসর", fmtRange(rg.fertile.from, rg.fertile.to), "est"), stat("পরবর্তী মাসিক", fmtDate(p.nextPeriod, { year: "numeric" }) + " (" + fmtRange(rg.nextPeriod.from, rg.nextPeriod.to) + ")", "est")),
      h("div", { class: "notice", role: "note" }, NOTICE),
      h("div", { class: "card" }, h("h2", {}, "বর্তমান চক্রের টাইমলাইন (" + bn(L) + " দিন)"), bar,
        h("p", { class: "mute" }, "মাসিক · ফলিকুলার · উর্বর সময় · ডিম্বস্ফোটন (" + bn(dOv) + " তম দিন) · লুটিয়াল"),
        h("p", {}, "হিসাবের নিয়ম: ডিম্বস্ফোটন ≈ পরবর্তী মাসিকের " + bn(a.lutealLength) + " দিন আগে (সেটিংসে বদলানো যায়, জানা না থাকলে ১৪)। উর্বর সময় = ডিম্বস্ফোটনের ৫ দিন আগে থেকে ডিম্বস্ফোটনের দিন পর্যন্ত, মোট ৬ দিন (Wilcox ১৯৯৫, NEJM)। চক্রের দৈর্ঘ্য: " + SOURCE_LABEL[a.source] + "।"),
        h("p", { class: "mute" }, "পরিসর = আনুমানিক তারিখের আগে-পরে ±" + bn(a.margin) + " দিন। এটি আপনার চক্রের ওঠানামার ভিত্তিতে নেওয়া সরলীকৃত অনিশ্চয়তা-সীমা, যাচাই-করা সম্ভাবনা-মডেল নয়। নিয়মিত চক্রেও উর্বর সময় এর বাইরে যেতে পারে।")));
  } catch (e) { showError(root, e, main); }
}
export const ready = main();
