import { initAdmin, SU } from "./admin-shell.js";
import { h, $, mount, loading, showError } from "../dom.js";
import { api } from "../api.js";
async function main() {
  if (!(await initAdmin(SU))) return;
  const root = $("#content"); let items = [], next = null;
  async function load(more) {
    if (!more) { items = []; loading(root); }
    try { const r = await api("admin.getAuditLogs", { limit: 50, offset: more ? next : 0 }); items.push(...r.items); next = r.nextOffset;
      mount(root, h("div", { class: "card" }, h("table", {}, h("thead", {}, h("tr", {}, ["সময়", "কাজ", "কর্তা", "লক্ষ্য"].map((t) => h("th", { scope: "col" }, t)))), h("tbody", {}, items.map((x) => h("tr", {}, h("td", {}, x.timestamp), h("td", {}, x.action), h("td", {}, x.actorUserId), h("td", {}, x.targetUserId || "—")))))),
        next !== null ? h("button", { class: "btn alt", type: "button", onclick: () => load(true) }, "আরও দেখান") : null); } catch (e) { showError(root, e, () => load(more)); }
  }
  await load(false);
}
export const ready = main();
