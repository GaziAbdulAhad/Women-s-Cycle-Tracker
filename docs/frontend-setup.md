# Frontend setup (Phase 4)

Runs on GitHub Pages: everything in the repo root except `apps-script/`, `worker/`, `tests/`, `docs/` (those are harmless if published, but contain no secrets).

1. Edit `js/config.js`: `API_BASE_URL` (your Worker URL, no trailing slash) and `GOOGLE_CLIENT_ID`. Both are public values.
2. **Tighten the CSP**: every `app`/`login`/`register` page has `connect-src ... https://*.workers.dev`. Replace it with your exact Worker origin (e.g. `https://womens-health-gateway.you.workers.dev`) in these HTML files: dashboard, calendar, period-entry, ovulation, journal, history, settings, account, login, register.
3. Google Cloud → OAuth client → Authorized JavaScript origins must contain your GitHub Pages origin (e.g. `https://username.github.io`), and the Worker's `ALLOWED_ORIGIN` must be the same string.
4. Push to GitHub → Settings → Pages → deploy from the branch root.
5. Open `login.html`, sign in, add a period, check the dashboard. Then test with two Google accounts that neither can see the other's data.

## What exists now
Everything in the plan: public pages, Google sign-in with consent records, dashboard, calendar, period entry, ovulation, journal, history, reports, reminders, learn, settings, account (export/delete), and `admin/*` pages. See `README.md` and `docs/deploy-guide.md`.
## Still not built
English UI, browser notifications. Real-browser, real-Google and deployed cross-origin tests are manual (`docs/security-test-plan.md`).
## Tests
`npm i` then `npm test`. `frontend-smoke.test.js` runs the page code in jsdom against a fake API: it is not a real-browser test.
