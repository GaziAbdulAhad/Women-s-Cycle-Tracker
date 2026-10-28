# চক্র — Women's Period, Ovulation & Cycle Tracker

HTML/CSS/vanilla-JS frontend on GitHub Pages → Cloudflare Worker (gateway) → Google Apps Script (business logic) → private Google Sheet.
Sign-in is Google Identity Services. All predictions are **estimates**, computed in the browser by `js/cycle-engine.js`.

```
Browser (GitHub Pages) ──Bearer session──▶ Cloudflare Worker ──HMAC-signed envelope──▶ Apps Script ──▶ private Google Sheet
   Google Sign-In ID token ─────────────────▶ (verifies token, issues 2h session in KV)   (authorises every action)
```

## What runs where
| Where | Files |
|---|---|
| GitHub Pages | `*.html`, `css/`, `js/`, `admin/` |
| Cloudflare Worker | `worker/` (`wrangler.toml`, `src/`) |
| Google Apps Script | `apps-script/*.gs` |
| Dev only | `tests/`, `docs/`, `package.json` |

## Features
Period log (create/edit/delete), estimated next period / ovulation / fertile window, calendar (month/week), daily journal, history, reports (chart, CSV, print/PDF), reminders (in-app + optional neutral e-mail), data export (JSON), account deletion, consent records, health-education pages + CMS, admin dashboard (roles: super_admin, support_admin, content_editor).

## Security model in one paragraph
Identity comes only from a Google ID token verified by the Worker (signature, issuer, audience, expiry, freshness, one-time nonce). The browser holds an opaque, revocable session; the Worker signs each request to Apps Script (HMAC, timestamp, nonce); Apps Script re-checks the signature, takes the user id only from it, scopes every read/write to that user, and reads admin roles only from the `AdminRoles` sheet. Admin APIs never return cycles, logs, symptoms or notes. Strict CSP on every page; no HTML-string injection; CSV export neutralises formulas.

## Limits you must understand
- **The spreadsheet owner can read all data** (it is not end-to-end encrypted). This is disclosed on the privacy page.
- Google Sheets/Apps Script are not designed for regulated health-data workloads, have quotas, and are slow for large data (plan a real database beyond tens of thousands of rows).
- Deleted rows can survive in the Sheet's version history and in any backups you keep until you remove them.
- Worker rate limiting is best-effort per instance: add a Cloudflare WAF rule.
- Legal pages and health-education text are **drafts** that need professional review.

## Tests
`npm i && npm test` (Node 20+). Covers the cycle engine, calendar/report models, the real Apps Script code (in a vm with mocks), the real Worker + Apps Script together (mock Google keys/network), static CSP/XSS rules, and page smoke tests in jsdom. **Not covered:** real Google Sign-In, a real Sheet/Apps Script deployment, real cross-origin browsers, layout. See `docs/security-test-plan.md`.

## Docs
`docs/deploy-guide.md` · `docs/launch-checklist.md` · `docs/security-test-plan.md` · `docs/troubleshooting.md` · `docs/apps-script-setup.md` · `docs/gateway-deploy.md` · `docs/frontend-setup.md`
