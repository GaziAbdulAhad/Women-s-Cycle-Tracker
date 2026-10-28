import { requireAuth } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, loading, showError, say } from "../dom.js";
import { api } from "../api.js";

const TITLE = { period_upcoming: "পরবর্তী মাসিকের আগে", daily_log: "দৈনিক জার্নাল লেখার কথা মনে করানো" };
async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const root = $("#content"); loading(root);
  try {
    const { items } = await api("reminders.list");
    mount(root, items.map((r) => {
      const en = h("input", { type: "checkbox", id: r.type + "-en" }), ch = h("select", { id: r.type + "-ch" }, h("option", { value: "in_app" }, "অ্যাপের ভেতরে (ড্যাশবোর্ডে)"), h("option", { value: "email" }, "ইমেইল (নিরপেক্ষ বার্তা)")),
        days = h("select", { id: r.type + "-days" }, [0, 1, 2, 3, 4, 5, 6, 7].map((n) => h("option", { value: n }, n === 0 ? "ঘটনার দিনেই" : n + " দিন আগে"))), msg = h("div", { role: "status", "aria-live": "polite" });
      en.checked = r.enabled; ch.value = r.channel; days.value = String(r.daysBefore);
      return h("form", { class: "card", onsubmit: async (ev) => {
        ev.preventDefault();
        try { await api("reminders.update", { type: r.type, enabled: en.checked, daysBefore: r.type === "daily_log" ? 0 : Number(days.value), channel: ch.value }); say(msg, "সেভ হয়েছে।"); } catch (e) { say(msg, e.message, "err"); }
      } }, h("h2", {}, TITLE[r.type]), h("label", { for: r.type + "-en" }, h("span", {}, "চালু রাখুন "), en),
        r.type === "period_upcoming" ? [h("label", { for: r.type + "-days" }, "কখন"), days] : null, h("label", { for: r.type + "-ch" }, "কীভাবে"), ch, h("p", {}, h("button", { class: "btn", type: "submit" }, "সেভ করুন")), msg);
    }),
    h("div", { class: "card" }, h("h2", {}, "রিমাইন্ডার কীভাবে কাজ করে"),
      h("ul", {}, h("li", {}, h("strong", {}, "অ্যাপের ভেতরে: "), "আপনি অ্যাপ খুললে ড্যাশবোর্ডে বার্তা দেখা যায়। অ্যাপ বন্ধ থাকলে কিছু আসে না।"),
        h("li", {}, h("strong", {}, "ইমেইল: "), "দিনে একবার চলা কাজ থেকে আপনার Google ইমেইলে একটি নিরপেক্ষ বার্তা যায় (বিষয়ে বা লেখায় কোনো তারিখ বা স্বাস্থ্যতথ্য থাকে না)। সেবার পরিচালক এই কাজ চালু না করলে ইমেইল যাবে না, আর Google-এর সীমা ও বিলম্বের কারণে সময়মতো পৌঁছানোর নিশ্চয়তা নেই।"),
        h("li", {}, h("strong", {}, "ব্রাউজার নোটিফিকেশন: "), "এখনো নেই।"))));
  } catch (e) { showError(root, e, main); }
}
export const ready = main();
