# Deployment guide (start to finish)

Services needing an account/billing/verification: Google Cloud (OAuth client), Google account for Apps Script/Sheets, Cloudflare (Workers + KV), GitHub (Pages). Free-tier limits change; check current pricing and quotas before launch.

1. **Google Cloud project** → console.cloud.google.com → create a project.
2. **OAuth consent screen + Web client ID** → APIs & Services → configure the consent screen (app name, support e-mail). Scopes: only basic sign-in (openid, email, profile). While the app is in "Testing", only listed test users can sign in; to let everyone in, publish the app and follow Google's current verification rules. Credentials → Create OAuth client ID → *Web application*. No client secret is used.
3. **Authorized JavaScript origins** → add your GitHub Pages origin, scheme + host only (e.g. `https://username.github.io`). Add `http://localhost:8080` only for local testing.
4. **Private spreadsheet** → created automatically in step 5 (`initializeDatabase`). Never share it, never make it "anyone with the link"; keep your Google account 2-step verification on.
5. **Apps Script project** → script.google.com → new project → add every file from `apps-script/` → run `initializeDatabase()` once (authorise).
6. **Script Properties** (Project Settings): `GATEWAY_SECRET` = output of `openssl rand -hex 32`; `APP_URL` = your site URL. (`SPREADSHEET_ID` was set by step 5.)
7. **Deploy as Web app**: Execute as *Me*, access *Anyone* (the Worker cannot sign in; the HMAC signature is the access control). Copy the `/exec` URL. After every code change create a **new version** of the deployment.
8. **Configure the Worker** → edit `worker/wrangler.toml`: `GOOGLE_CLIENT_ID`, `ALLOWED_ORIGIN` (same origin as step 3), KV namespace id (`npx wrangler kv namespace create SESSIONS`).
9. **Secrets** → `cd worker && npx wrangler secret put GATEWAY_SECRET` (same value as step 6) and `npx wrangler secret put APPS_SCRIPT_URL`.
10. **Deploy the Worker** → `npx wrangler deploy`; note the `workers.dev` URL. Smoke test: `curl https://<worker>/health`.
11. **GitHub Pages** → push the repo; Settings → Pages → deploy from branch root (or use `.github/workflows/pages.yml`, untested template).
12. **Production URLs** → set `API_BASE_URL` and `GOOGLE_CLIENT_ID` in `js/config.js`; replace `https://*.workers.dev` in each page's CSP with your exact Worker origin.
13. **Test sign-in** → open `register.html`, accept terms, sign in with Google, add a period, open the dashboard. If sign-in fails see `troubleshooting.md`.
14. **First admin + isolation tests** → find your `userId` in the `Users` sheet, add a row to `AdminRoles`: `userId, super_admin, true, <iso time>, <iso time>`. Then run `docs/security-test-plan.md` with two Google accounts.
15. **Reminder e-mails (optional)** → run `installReminderTrigger()` in Apps Script. Mail quotas apply; triggers are best-effort. **Backups & monitoring:** schedule periodic copies of the spreadsheet, watch Apps Script *Executions* and Cloudflare analytics/logs (no health data is logged by this code), set a WAF rate-limit rule on `/auth/*` and `/api`.
16. **Launch** → complete `docs/launch-checklist.md`.
