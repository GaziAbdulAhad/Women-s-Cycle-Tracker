import { api } from "./api.js";
async function all(action, extra = {}) {
  const items = []; let offset = 0;
  for (let i = 0; i < 50; i++) {
    const r = await api(action, { ...extra, limit: 100, offset });
    items.push(...r.items);
    if (r.nextOffset === null || r.nextOffset === undefined) break;
    offset = r.nextOffset;
  }
  return items;
}
export const loadCycles = () => all("cycles.list");
export const loadLogs = (from, to) => all("dailyLogs.list", { ...(from ? { from } : {}), ...(to ? { to } : {}) });
