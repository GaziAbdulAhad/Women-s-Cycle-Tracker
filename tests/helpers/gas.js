// Loads the REAL apps-script/*.gs files into a Node vm with in-memory mocks (same approach as apps-script.test.js).
import vm from "node:vm";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../apps-script");
export function createGas(secret) {
  const mail = [];
  const props = { GATEWAY_SECRET: secret, SPREADSHEET_ID: "mock" }, cache = new Map(), sheets = {};
  const mk = (h) => { const rows = [h.slice()]; return { rows, getLastRow: () => rows.length,
    getRange: (r, c, nr = 1, nc = 1) => ({ getValues: () => rows.slice(r - 1, r - 1 + nr).map((x) => x.slice(c - 1, c - 1 + nc)),
      setValues: (v) => v.forEach((row, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach((x, j) => (rows[r - 1 + i][c - 1 + j] = x)); }) }),
    appendRow: (a) => rows.push(a.slice()), deleteRow: (n) => rows.splice(n - 1, 1), deleteRows: (n, c) => rows.splice(n - 1, c) }; };
  const ctx = vm.createContext({ console: { log() {}, error() {}, warn() {} },
    Utilities: { getUuid: () => crypto.randomUUID(),
      computeHmacSha256Signature: (m, s) => Array.from(crypto.createHmac("sha256", s).update(m).digest()).map((b) => (b > 127 ? b - 256 : b)),
      formatDate: (d, tz, f) => { const s = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); return f === "yyyy" ? s.slice(0, 4) : s; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) || null, put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (s) => ({ s, setMimeType() { return this; } }) },
    MailApp: { getRemainingDailyQuota: () => 100, sendEmail: (to, subject, body) => mail.push({ to, subject, body }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: (n) => sheets[n] }) } });
  const files = ["Config", "SecurityService", "ValidationService", "DatabaseService", "AuditService", "AuthService", "CycleService", "JournalService", "ConsentService", "ReminderService", "AccountService", "AdminService", "Code"];
  vm.runInContext(files.map((f) => fs.readFileSync(path.join(dir, f + ".gs"), "utf8")).join("\n"), ctx);
  const H = vm.runInContext("CONFIG.HEADERS", ctx);
  Object.keys(H).forEach((n) => (sheets[n] = mk(H[n])));
  return { sheets, mail, run: (name) => vm.runInContext(name, ctx), doPost: vm.runInContext("doPost", ctx) };
}
