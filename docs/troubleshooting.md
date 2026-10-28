# Troubleshooting
| Symptom | Likely cause / fix |
|---|---|
| "সেটআপ বাকি" on login | `js/config.js` still has placeholders |
| "Google Sign-In লোড হয়নি" | Ad-blocker/offline; CSP edited and no longer allows `https://accounts.google.com/gsi/…` |
| Google popup error "origin not allowed" | Site origin missing from OAuth *Authorized JavaScript origins* (exact scheme+host, no path/slash) |
| Browser console CORS error | `ALLOWED_ORIGIN` ≠ site origin; or the CSP `connect-src` doesn't list the Worker |
| Login 401 "Sign-in failed" | Wrong `GOOGLE_CLIENT_ID` in Worker, token older than 10 min, nonce expired/used (reload page), unverified Google e-mail, device clock far off. Check `wrangler tail` for the logged `reason` (no tokens are logged) |
| 502 "Service temporarily unavailable" on every call | `GATEWAY_SECRET` differs between Worker and Apps Script; wrong `APPS_SCRIPT_URL`; deployment not re-versioned after code changes; access not set to *Anyone*; Apps Script quota hit — see *Executions* |
| 403 `ACCOUNT_DISABLED` | Account suspended by an admin (Users sheet `status`) |
| 503 `MAINTENANCE` | Maintenance mode on (admin settings, or `AppSettings` row `maintenanceMode`) |
| Sent back to the consent page repeatedly | `consents.record` failing, or `POLICY_VERSION` was bumped; check Apps Script logs |
| Admin page says "no access" | Row missing/`active` not `true` in `AdminRoles`, or wrong `userId` (must equal Google `sub` in `Users`) |
| Dates look one day off | Check profile timezone in Settings (default Asia/Dhaka) |
| "Exception: Service invoked too many times" | Apps Script quotas; reduce traffic or move off Sheets |
| Reminder e-mails not arriving | Trigger not installed, mail quota, user channel set to in-app, spam folder; triggers can be delayed |
| Sessions end unexpectedly | 2-hour session lifetime; tab closed (sessionStorage); KV revocation lag up to ~1 minute |
