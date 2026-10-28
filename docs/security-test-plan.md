# Security & integration test plan (run on the DEPLOYED system)
Automated tests (`npm test`) use mocks. These manual tests are what proves the real deployment. Use two normal Google accounts (A, B), one admin, one suspended.

| # | Test | Expected |
|---|---|---|
| 1 | Sign in with A on the real site | Dashboard loads; `Users` row created; 3 `Consents` rows |
| 2 | Open the site from another origin / `curl` without `Origin` against `/auth/nonce` | 403 `FORBIDDEN_ORIGIN`, no CORS headers |
| 3 | Replay the same Google credential to `/auth/login` | 401 |
| 4 | Send `/api` with no token, a fake token, and after Sign out | 401 each time |
| 5 | A creates a period + log; B signs in | B sees none of A's data; B calling update/delete with A's ids gets 404 |
| 6 | B edits JS/requests to add `userId`, `role`, `status` fields | Ignored; no privilege change |
| 7 | Ordinary user opens `/admin/*.html` and calls `admin.*` | "no access" in UI; 403 from API |
| 8 | support_admin / content_editor try actions outside their role | 403 (see role matrix in README) |
| 9 | Admin screens and `admin.*` responses | No cycles, logs, symptoms or notes anywhere |
| 10 | Suspend B from admin | B's next call is rejected and the session is revoked |
| 11 | Maintenance mode on | Users get 503 message; admins still work; turn off |
| 12 | Tamper with the Worker→Apps Script request (curl the `/exec` URL with a bad/old signature, replayed body) | Rejected (`UNAUTHENTICATED`) |
| 13 | Invalid / future dates, 91-day cycle, duplicate period, 1,000-char note | Validation errors, nothing saved |
| 14 | Notes like `=HYPERLINK("http://x")` → open the CSV in Excel/Sheets and the Sheet itself | Shown as text, not executed |
| 15 | Export JSON, then delete account (A) | JSON has only A's data; all A's rows gone from every sheet; session dead; B unaffected; check Sheet version history and decide how to purge it |
| 16 | Concurrent writes: two tabs add periods at once | No lost/duplicated rows |
| 17 | Break the Worker URL / Apps Script (undeploy) | Friendly Bengali error, nothing saved silently |
| 18 | Browser matrix (Chrome, Firefox, Safari, mobile) for sign-in popup, CORS, print | All work; record versions tested |
| 19 | DevTools: no secrets in JS/HTML; token only in `sessionStorage`; CSP violations: none | Pass |
| 20 | Reminder e-mail trigger | Neutral subject/body; no dates; only for e-mail-channel users |
