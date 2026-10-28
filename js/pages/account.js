import { requireAuth } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, fmtDate, say } from "../dom.js";
import { api, logout } from "../api.js";
import { download } from "../csv.js";

async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const u = s.user || {};
  mount($("#content"),
    h("div", { class: "card" }, h("h2", {}, "অ্যাকাউন্ট"),
      /^https:\/\//.test(u.photoURL || "") ? h("img", { src: u.photoURL, alt: "", width: "64", height: "64", referrerpolicy: "no-referrer" }) : null,
      h("p", {}, h("strong", {}, u.displayName || "—")), h("p", { class: "mute" }, u.email || ""),
      u.createdAt ? h("p", { class: "mute" }, "অ্যাকাউন্ট খোলা হয়েছে: " + fmtDate(u.createdAt.slice(0, 10), { year: "numeric" })) : null,
      h("p", {}, "সাইন-ইন Google-এর মাধ্যমে হয়। আমরা আপনার Google পাসওয়ার্ড দেখি না বা রাখি না।"),
      h("button", { class: "btn alt", type: "button", onclick: async () => { await logout(); location.replace("index.html"); } }, "সাইন আউট")),
    h("div", { class: "card" }, h("h2", {}, "আপনার তথ্য"),
      h("p", { class: "mute" }, "আপনার সব তথ্য JSON ফাইলে ডাউনলোড করতে পারেন। ফাইলে আপনার ব্যক্তিগত স্বাস্থ্যতথ্য থাকবে, তাই নিরাপদ জায়গায় রাখুন।"),
      h("button", { class: "btn alt", type: "button", onclick: async (ev) => { ev.target.disabled = true; try { const d = await api("user.exportData"); download("cycle-my-data.json", JSON.stringify(d, null, 2), "application/json"); say(msg, "ডাউনলোড শুরু হয়েছে।"); } catch (e) { say(msg, e.message, "err"); } ev.target.disabled = false; } }, "আমার সব তথ্য ডাউনলোড"),
      h("div", { role: "status", id: "amsg", "aria-live": "polite" })),
    h("div", { class: "card" }, h("h2", {}, "অ্যাকাউন্ট মুছে ফেলুন"),
      h("p", {}, "এতে আপনার অ্যাকাউন্ট, সব মাসিক, জার্নাল, রিমাইন্ডার ও সম্মতির রেকর্ড স্থায়ীভাবে মুছে যাবে। এটি ফেরানো যাবে না। আগে তথ্য ডাউনলোড করে রাখুন।"),
      h("label", { for: "confirmDel" }, "নিশ্চিত করতে DELETE লিখুন"), h("input", { id: "confirmDel", type: "text", autocomplete: "off" }),
      h("p", {}, h("button", { class: "btn danger", type: "button", onclick: async (ev) => {
        if ($("#confirmDel").value !== "DELETE") return say(msg, "নিশ্চিত করতে ঠিক DELETE লিখুন।", "err");
        ev.target.disabled = true;
        try { await api("user.deleteAccount", { confirm: "DELETE" }); await logout(); location.replace("index.html"); } catch (e) { say(msg, e.message, "err"); ev.target.disabled = false; }
      } }, "অ্যাকাউন্ট ও সব তথ্য মুছুন")),
      h("p", { class: "mute" }, "মুছে ফেলার পর একই Google অ্যাকাউন্টে আবার সাইন ইন করলে নতুন, খালি অ্যাকাউন্ট তৈরি হবে।")));
  const msg = $("#amsg");
}
export const ready = main();
