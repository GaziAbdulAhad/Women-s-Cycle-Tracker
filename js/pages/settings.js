import { requireAuth, updateUser } from "../auth.js";
import { initShell } from "../shell.js";
import { h, $, mount, say } from "../dom.js";
import { api } from "../api.js";
import { AGE_LABEL } from "../text.js";

const num = (v) => (v === "" ? null : Number(v));
async function main() {
  const s = requireAuth(); if (!s) return;
  initShell({ isPrivate: true });
  const u = s.user || {};
  let zones = ["Asia/Dhaka", "UTC"]; try { zones = Intl.supportedValuesOf("timeZone"); } catch { /* older browsers */ }
  if (!zones.includes(u.timezone)) zones = [u.timezone || "Asia/Dhaka", ...zones];
  mount($("#tz"), zones.map((z) => h("option", { value: z }, z)));
  mount($("#age"), Object.entries(AGE_LABEL).map(([k, v]) => h("option", { value: k }, v)));
  $("#dname").value = u.displayName || ""; $("#tz").value = u.timezone || "Asia/Dhaka";
  $("#cl").value = u.cycleLengthDefault || ""; $("#ll").value = u.lutealLength || ""; $("#age").value = u.ageBand || "";
  $("#sform").addEventListener("submit", async (ev) => {
    ev.preventDefault(); $("#saveBtn").disabled = true;
    try {
      const user = await api("user.updateProfile", { displayName: $("#dname").value, timezone: $("#tz").value, cycleLengthDefault: num($("#cl").value), lutealLength: num($("#ll").value), ageBand: $("#age").value });
      updateUser(user); say($("#msg"), "সেভ হয়েছে। পূর্বাভাস নতুন সেটিং দিয়ে হিসাব হবে।");
    } catch (e) { say($("#msg"), e.message, "err"); }
    $("#saveBtn").disabled = false;
  });
}
export const ready = main();
