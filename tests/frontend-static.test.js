// Static security/quality checks over every page and script. Cheap regression guard for the CSP rules.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmls = [...fs.readdirSync(root).filter((f) => f.endsWith(".html")), ...fs.readdirSync(path.join(root, "admin")).filter((f) => f.endsWith(".html")).map((f) => "admin/" + f)];
const jsFiles = ["js", "js/pages", "js/admin"].flatMap((d) => fs.readdirSync(path.join(root, d)).filter((f) => f.endsWith(".js")).map((f) => path.join(d, f)));

test("expected pages exist", () => {
  for (const f of ["index", "features", "health-education", "privacy", "terms", "disclaimer", "login", "register", "dashboard", "calendar", "period-entry", "ovulation", "journal", "history", "settings", "account", "reminders", "reports", "learn", "admin/index", "admin/users", "admin/content", "admin/reports", "admin/audit-logs", "admin/settings"]) assert.ok(htmls.includes(f + ".html"), f);
});
test("every page: CSP meta, no inline script/handlers/styles, no unsafe CSP", () => {
  for (const f of htmls) {
    const s = fs.readFileSync(path.join(root, f), "utf8");
    assert.match(s, /http-equiv="Content-Security-Policy"/, f);
    assert.ok(!/script-src[^;]*unsafe|unsafe-eval/.test(s), f + " script CSP");
    if (!["login.html", "register.html"].includes(f)) assert.ok(!/unsafe-inline/.test(s), f); // only Google\'s sign-in button needs inline styles
    assert.match(s, /font-src 'self'/, f);
    assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/i.test(s), f + " inline script");
    assert.ok(!/\son[a-z]+\s*=/i.test(s.replace(/content="[^"]*"/g, "")), f + " inline handler");
    assert.ok(!/\sstyle\s*=/i.test(s), f + " inline style");
    assert.match(s, /<html lang="bn">/, f);
  }
});
test("local links, scripts and styles resolve", () => {
  for (const f of htmls) {
    const s = fs.readFileSync(path.join(root, f), "utf8");
    for (const m of s.matchAll(/(?:href|src)="([^"#?:]+?)(?:[?#][^"]*)?"/g)) { if (/^(https?:|data:|mailto:)/.test(m[1])) continue; assert.ok(fs.existsSync(path.join(root, path.dirname(f), m[1])), f + " -> " + m[1]); }
  }
});
test("JS never uses innerHTML/eval/document.write/localStorage for sessions", () => {
  for (const f of jsFiles) { const s = fs.readFileSync(path.join(root, f), "utf8"); assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(|document\.write|new Function|localStorage/.test(s), f); }
});
test("no secrets in frontend config", () => {
  const s = fs.readFileSync(path.join(root, "js/config.js"), "utf8");
  assert.ok(!/secret|GATEWAY|APPS_SCRIPT|script\.google\.com/i.test(s.replace(/\/\/.*$/gm, "")));
});
test("font files referenced by css/fonts.css exist and are self-hosted", () => {
  const c = fs.readFileSync(path.join(root, "css/fonts.css"), "utf8");
  const urls = [...c.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= 6);
  for (const u of urls) { assert.ok(!/^https?:/.test(u), u); assert.ok(fs.existsSync(path.join(root, "css", u)), u); }
});
