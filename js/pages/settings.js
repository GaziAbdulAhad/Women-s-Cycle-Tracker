import { requireAuth, updateUser } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, say } from "../dom.js";
import { api } from "../api.js";

async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const u = s.user || {};
  let zones = ["Asia/Dhaka", "UTC"]; try { zones = Intl.supportedValuesOf("timeZone"); } catch { /* older browsers */ }
  if (!zones.includes(u.timezone)) zones = [u.timezone || "Asia/Dhaka", ...zones];
  mount($("#tz"), zones.map((z) => h("option", { value: z }, z)));
  $("#dname").value = u.displayName || ""; $("#tz").value = u.timezone || "Asia/Dhaka"; $("#lang").value = u.language || "bn";
  $("#sform").addEventListener("submit", async (ev) => {
    ev.preventDefault(); $("#saveBtn").disabled = true;
    try { const user = await api("user.updateProfile", { displayName: $("#dname").value, timezone: $("#tz").value, language: $("#lang").value }); updateUser(user); say($("#msg"), "সেভ হয়েছে।"); }
    catch (e) { say($("#msg"), e.message, "err"); }
    $("#saveBtn").disabled = false;
  });
}
export const ready = main();
