import { initAdmin, CE } from "./admin-shell.js";
import { h, $, mount, fmtDate, loading, showError, say } from "../dom.js";
import { api } from "../api.js";
async function main() {
  if (!(await initAdmin(CE))) return;
  const list = $("#list"), msg = $("#msg"); let editing = null;
  const reset = () => { editing = null; $("#aform").reset(); $("#cancelBtn").hidden = true; };
  async function load() {
    loading(list);
    try {
      const { items } = await api("admin.listArticles");
      mount(list, items.length ? h("ul", { class: "list" }, items.map((a) => h("li", {}, h("span", {}, h("strong", {}, a.title), " ", h("span", { class: "badge" }, a.status === "published" ? "প্রকাশিত" : "খসড়া"), h("br"), h("small", { class: "mute" }, fmtDate(a.updatedAt.slice(0, 10), { year: "numeric" }))),
        h("span", { class: "row" }, h("button", { class: "btn alt", type: "button", onclick: () => { editing = a.id; $("#atitle").value = a.title; $("#abody").value = a.body; $("#astatus").value = a.status; $("#cancelBtn").hidden = false; $("#atitle").focus(); } }, "সম্পাদনা"),
          h("button", { class: "btn danger", type: "button", onclick: async () => { if (!confirm("লেখাটি মুছে ফেলবেন?")) return; try { await api("admin.deleteArticle", { id: a.id }); if (editing === a.id) reset(); await load(); } catch (e) { say(msg, e.message, "err"); } } }, "মুছুন"))))) : h("p", { class: "mute" }, "এখনো কোনো লেখা নেই."));
    } catch (e) { showError(list, e, load); }
  }
  $("#cancelBtn").addEventListener("click", reset);
  $("#aform").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try { await api("admin.saveArticle", { ...(editing ? { id: editing } : {}), title: $("#atitle").value, body: $("#abody").value, status: $("#astatus").value }); reset(); say(msg, "সেভ হয়েছে।"); await load(); } catch (e) { say(msg, e.message, "err"); }
  });
  await load();
}
export const ready = main();
