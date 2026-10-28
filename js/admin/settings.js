import { initAdmin, SU } from "./admin-shell.js";
import { $, say, loading, showError } from "../dom.js";
import { api } from "../api.js";
async function main() {
  if (!(await initAdmin(SU))) return;
  try { $("#maint").checked = (await api("admin.getSettings")).maintenanceMode; } catch (e) { return showError($("#msg"), e, main); }
  $("#sform").hidden = false;
  $("#sform").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try { const r = await api("admin.updateSettings", { maintenanceMode: $("#maint").checked }); say($("#msg"), r.maintenanceMode ? "রক্ষণাবেক্ষণ মোড চালু হয়েছে।" : "রক্ষণাবেক্ষণ মোড বন্ধ হয়েছে।"); } catch (e) { say($("#msg"), e.message, "err"); }
  });
}
export const ready = main();
