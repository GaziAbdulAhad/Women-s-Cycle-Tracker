import { h, $, mount } from "./dom.js";
import { getSession, currentPage } from "./auth.js";
import { logout } from "./api.js";

const PRIVATE = [["dashboard.html", "ড্যাশবোর্ড"], ["calendar.html", "ক্যালেন্ডার"], ["period-entry.html", "মাসিক এন্ট্রি"], ["ovulation.html", "ডিম্বস্ফোটন"], ["journal.html", "জার্নাল"], ["history.html", "ইতিহাস"], ["reports.html", "রিপোর্ট"], ["reminders.html", "রিমাইন্ডার"], ["learn.html", "শেখার তথ্য"], ["settings.html", "সেটিংস"]];
const PUBLIC = [["features.html", "ফিচার"], ["health-education.html", "স্বাস্থ্য তথ্য"], ["disclaimer.html", "চিকিৎসা সতর্কতা"]];

export function initShell({ isPrivate }) {
  const page = currentPage(), s = getSession();
  const links = (isPrivate ? PRIVATE : PUBLIC).map(([href, label]) => h("a", { href, "aria-current": href === page ? "page" : null }, label));
  const right = isPrivate && s
    ? h("div", { class: "who" }, h("a", { href: "account.html" }, (s.user && (s.user.displayName || s.user.email)) || "অ্যাকাউন্ট"),
        h("button", { class: "btn alt", type: "button", onclick: async () => { await logout(); location.replace("index.html"); } }, "সাইন আউট"))
    : h("a", { class: "btn", href: s ? "dashboard.html" : "login.html" }, s ? "ড্যাশবোর্ড" : "সাইন ইন");
  mount($("#site-header"), h("div", { class: "bar" }, h("a", { class: "brand", href: isPrivate ? "dashboard.html" : "index.html" }, "চক্র"), h("nav", { class: "nav", "aria-label": "প্রধান মেনু" }, links), right));
  mount($("#site-footer"), h("nav", { "aria-label": "আইনি" }, h("a", { href: "privacy.html" }, "গোপনীয়তা"), h("a", { href: "terms.html" }, "শর্তাবলি"), h("a", { href: "disclaimer.html" }, "চিকিৎসা সতর্কতা")),
    h("p", {}, "এটি স্বাস্থ্য-সহায়ক ট্র্যাকার, চিকিৎসকের পরামর্শ বা রোগ নির্ণয়ের বিকল্প নয়।"));
}
