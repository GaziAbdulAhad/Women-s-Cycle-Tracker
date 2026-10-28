import { requireAuth } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, fmtDate, loading, showError } from "../dom.js";
import { api } from "../api.js";
async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const root = $("#content"); loading(root);
  try {
    const { items } = await api("content.list");
    mount(root, items.length ? items.map((a) => h("article", { class: "card" }, h("h2", {}, a.title), a.body.split(/\n+/).map((p) => h("p", {}, p)), h("p", { class: "mute" }, "হালনাগাদ: " + fmtDate(a.updatedAt.slice(0, 10), { year: "numeric" })))) : h("p", { class: "mute" }, "এখনো কোনো লেখা প্রকাশিত হয়নি।"),
      h("p", { class: "mute" }, "এগুলো সাধারণ তথ্য, চিকিৎসকের পরামর্শের বিকল্প নয়।"));
  } catch (e) { showError(root, e, main); }
}
export const ready = main();
