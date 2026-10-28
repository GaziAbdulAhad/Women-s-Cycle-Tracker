import { requireAuth } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, fmtDate, todayIn, isIso, loading, showError, say } from "../dom.js";
import { api } from "../api.js";
import { FLOW, MOOD, SYMPTOMS, logSummary } from "../text.js";

async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const today = todayIn(s.user && s.user.timezone), msg = $("#msg"); let cur = null;
  const opts = (sel, o) => mount(sel, Object.entries(o).map(([k, v]) => h("option", { value: k }, v)));
  opts($("#flow"), FLOW); opts($("#mood"), MOOD);
  mount($("#sym"), Object.entries(SYMPTOMS).map(([k, v]) => h("label", {}, h("input", { type: "checkbox", value: k }), h("span", {}, v))));
  const q = new URLSearchParams(location.search).get("date");
  $("#jdate").max = today; $("#jdate").value = isIso(q) && q <= today ? q : today;

  async function loadDay() {
    say(msg, "");
    try { cur = (await api("dailyLogs.list", { from: $("#jdate").value, to: $("#jdate").value, limit: 1 })).items[0] || null; } catch (e) { return say(msg, e.message, "err"); }
    $("#flow").value = cur ? cur.flowLevel : ""; $("#mood").value = cur ? cur.mood : "";
    $("#sleep").value = cur && cur.sleepHours != null ? cur.sleepHours : ""; $("#jnotes").value = cur ? cur.notes : "";
    const syms = cur ? cur.symptoms : [];
    document.querySelectorAll("#sym input").forEach((i) => { i.checked = syms.includes(i.value); });
    $("#custom").value = syms.filter((x) => !(x in SYMPTOMS)).join(", ");
    $("#delBtn").hidden = !cur;
  }
  async function recent() {
    const box = $("#recent"); loading(box);
    try { const r = await api("dailyLogs.list", { limit: 10 }); mount(box, r.items.length ? h("ul", { class: "list" }, r.items.map((l) => h("li", {}, h("a", { href: "journal.html?date=" + l.date }, fmtDate(l.date, { year: "numeric" })), h("span", { class: "mute" }, logSummary(l) || "—")))) : h("p", { class: "mute" }, "এখনো কোনো জার্নাল নেই।")); }
    catch (e) { showError(box, e, recent); }
  }
  $("#jdate").addEventListener("change", loadDay);
  $("#jform").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const known = [...document.querySelectorAll("#sym input:checked")].map((i) => i.value);
    const extra = $("#custom").value.split(/[,،]/).map((x) => x.trim()).filter(Boolean);
    const payload = { date: $("#jdate").value, flowLevel: $("#flow").value, mood: $("#mood").value, sleepHours: $("#sleep").value === "" ? "" : Number($("#sleep").value), symptoms: [...known, ...extra], notes: $("#jnotes").value };
    $("#saveBtn").disabled = true;
    try { await api(cur ? "dailyLogs.update" : "dailyLogs.create", cur ? { logId: cur.logId, ...payload } : payload); say(msg, "সেভ হয়েছে।"); await loadDay(); await recent(); }
    catch (e) { say(msg, e.message, "err"); }
    $("#saveBtn").disabled = false;
  });
  $("#delBtn").addEventListener("click", async () => {
    if (!cur || !confirm("এই দিনের জার্নাল মুছে ফেলবেন?")) return;
    try { await api("dailyLogs.delete", { logId: cur.logId }); await loadDay(); say(msg, "মুছে ফেলা হয়েছে।"); await recent(); } catch (e) { say(msg, e.message, "err"); }
  });
  await Promise.all([loadDay(), recent()]);
}
export const ready = main();
