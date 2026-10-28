# Apps Script backend — setup (Phase 2)

1. script.google.com → New project → add every file in `apps-script/` (same names, `.gs`).
2. Run `initializeDatabase()` once (authorise when asked). It creates the PRIVATE spreadsheet and stores `SPREADSHEET_ID`. Never share that spreadsheet.
3. Generate a secret on your computer: `openssl rand -hex 32`. Project Settings → Script properties → add `GATEWAY_SECRET` = that value. The same value goes into the Cloudflare Worker secret in Phase 3. Never commit it.
4. Deploy → New deployment → Web app → Execute as **Me**, Who has access **Anyone**. (The Worker cannot sign in to Google; the HMAC signature is the access control. Without a valid signature every request is rejected.)
5. Copy the Web app URL for the Worker (`APPS_SCRIPT_URL`).
6. After every code change: Deploy → Manage deployments → edit → New version (the URL stays the same).

Verified locally with mocks: `node --test tests/apps-script.test.js`. NOT yet verified on a real deployment (quotas, real Sheets behaviour, real Google tokens) — that happens with the Worker in Phase 3.
