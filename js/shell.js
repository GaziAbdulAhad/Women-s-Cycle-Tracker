import { h, $, mount, icon } from "./dom.js";
import { getSession, currentPage } from "./auth.js";
import { logout } from "./api.js";

const MAIN = [["dashboard.html", "হোম", "home"], ["calendar.html", "ক্যালেন্ডার", "calendar"], ["period-entry.html", "মাসিক", "plus", "add"], ["journal.html", "জার্নাল", "book"]];
const MORE = [["ovulation.html", "ডিম্বস্ফোটন"], ["history.html", "ইতিহাস"], ["reports.html", "রিপোর্ট"], ["reminders.html", "রিমাইন্ডার"], ["learn.html", "শেখার তথ্য"], ["settings.html", "সেটিংস"], ["account.html", "অ্যাকাউন্ট"]];
const PUBLIC = [["features.html", "ফিচার"], ["health-education.html", "স্বাস্থ্য তথ্য"], ["disclaimer.html", "চিকিৎসা সতর্কতা"]];
const cur = (href, page) => (href === page ? "page" : null);

export function initShell({ isPrivate }) {
  const page = currentPage(), s = getSession();
  let nav, right;
  if (isPrivate) {
    const details = h("details", { class: "more" },
      h("summary", { class: MORE.some(([hr]) => hr === page) ? "on" : null, "aria-label": "আরও মেনু" }, icon("menu"), h("span", {}, "আরও")),
      h("div", { class: "more-panel" }, MORE.map(([hr, label]) => h("a", { href: hr, "aria-current": cur(hr, page) }, label))));
    nav = h("nav", { class: "nav app", "aria-label": "প্রধান মেনু" }, MAIN.map(([hr, label, ic, cls]) => h("a", { href: hr, class: cls, "aria-current": cur(hr, page) }, icon(ic), h("span", {}, label))), details);
    const name = (s && s.user && (s.user.displayName || s.user.email)) || "";
    right = h("div", { class: "who" }, h("a", { class: "avatar", href: "account.html", "aria-label": "অ্যাকাউন্ট" }, (name.trim()[0] || "চ").toUpperCase()),
      h("button", { class: "btn alt", type: "button", onclick: async () => { await logout(); location.replace("index.html"); } }, "সাইন আউট"));
    document.addEventListener("click", (e) => { if (!details.contains(e.target)) details.removeAttribute("open"); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") details.removeAttribute("open"); });
  } else {
    nav = h("nav", { class: "nav", "aria-label": "প্রধান মেনু" }, PUBLIC.map(([hr, label]) => h("a", { href: hr, "aria-current": cur(hr, page) }, label)));
    right = h("div", { class: "who" }, h("a", { class: "btn", href: s ? "dashboard.html" : "login.html" }, s ? "ড্যাশবোর্ড" : "সাইন ইন"));
  }
  mount($("#site-header"), h("div", { class: "bar" }, h("a", { class: "brand", href: isPrivate ? "dashboard.html" : "index.html" }, "চক্র"), nav, right));
  mount($("#site-footer"), h("nav", { "aria-label": "আইনি" }, h("a", { href: "privacy.html" }, "গোপনীয়তা"), h("a", { href: "terms.html" }, "শর্তাবলি"), h("a", { href: "disclaimer.html" }, "চিকিৎসা সতর্কতা")),
    h("p", {}, "এটি স্বাস্থ্য-সহায়ক ট্র্যাকার, চিকিৎসকের পরামর্শ বা রোগ নির্ণয়ের বিকল্প নয়।"));
}
