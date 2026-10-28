# Cloudflare Worker gateway — deploy (Phase 3)

Needs: a Cloudflare account (the Workers/KV free tiers have limits that change — check current pricing before launch), Node 20+, and the Apps Script Web App URL from `docs/apps-script-setup.md`.

1. **Google OAuth client** (Google Cloud Console → APIs & Services → Credentials → OAuth client ID → *Web application*). Add your GitHub Pages origin under *Authorized JavaScript origins* (scheme + host only, e.g. `https://username.github.io`). Copy the Client ID. No client secret is needed or used.
2. `cd worker && npm i -D wrangler && npx wrangler login`
3. `npx wrangler kv namespace create SESSIONS` → put the returned id into `wrangler.toml`.
4. Edit `wrangler.toml`: `GOOGLE_CLIENT_ID`, `ALLOWED_ORIGIN` (exactly the origin from step 1).
5. Secrets (never commit): `npx wrangler secret put GATEWAY_SECRET` (the SAME value as the Apps Script `GATEWAY_SECRET`) and `npx wrangler secret put APPS_SCRIPT_URL`.
6. `npx wrangler deploy` → note the `https://….workers.dev` URL (this becomes `API_BASE_URL` in the frontend).
7. Smoke test: `curl https://<worker>/health` → `{"ok":true,...}`. Browser-only routes need the Origin header, e.g. `curl -H "Origin: https://username.github.io" https://<worker>/auth/nonce`.

## API contract (for the frontend, Phase 4)
- `GET /auth/nonce` → `{data:{nonce}}`. Pass it as `nonce` to `google.accounts.id.initialize(...)`.
- `POST /auth/login {credential}` → `{data:{session, expiresAt, user}}`. Fresh token (≤10 min old), matching one-time nonce, verified email.
- `POST /api {action, payload}` with `Authorization: Bearer <session>`.
- `POST /auth/logout` revokes the session.
- Errors: `{ok:false,error:{code,message},requestId}`. 401 → sign in again.

## Security notes — read before launch
- **Bearer token, not cookie.** GitHub Pages and workers.dev are different sites, so cross-site cookies are blocked by many browsers. The session is therefore a bearer token. The frontend keeps it in `sessionStorage` (this tab only, cleared when the tab closes; needed because the site is multi-page). Any XSS on the site could read it, so every page ships a strict CSP (no inline script, no `unsafe-inline`), and the JS never builds HTML from strings. Sessions last 2 h (max 8 h) and are revocable.
- **KV is eventually consistent**: a logout/revocation can take up to about a minute to reach every Cloudflare location. A suspended account is also cut off on its next API call (Apps Script returns `ACCOUNT_DISABLED`).
- **Rate limiting in the Worker is best-effort per isolate**, not global. Add a Cloudflare WAF rate-limiting rule on `/auth/*` and `/api` for real protection.
- The Worker only forwards allow-listed actions; identity always comes from the verified session.
- Google signing keys are fetched from Google's JWKS endpoint (not `tokeninfo`) and cached.
- Tests: `npm test` runs Worker + real Apps Script code against mocks and a locally generated RSA key. Real-Google, real-Sheets and cross-origin browser tests are still required on the deployed system.
