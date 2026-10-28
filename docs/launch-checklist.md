# Production launch checklist
Do not call the system production-ready until every box is ticked **and** the manual tests in `security-test-plan.md` pass on the deployed system.

## Legal, medical, privacy
- [ ] Privacy policy, terms and disclaimer reviewed by a qualified professional; "draft" banners removed; check the data-protection rules that apply to you and your users.
- [ ] Health-education text reviewed by a clinician; add specific sources (ACOG, NHS, WHO etc.) after checking them yourself.
- [ ] `POLICY_VERSION` in `js/config.js` bumped whenever legal text changes (forces re-consent).
- [ ] Retention and backup-deletion rules decided and written into the privacy policy.
## Security
- [ ] `GATEWAY_SECRET` is random, ≥32 bytes, stored only in Script Properties + Worker secret; rotation plan written.
- [ ] Spreadsheet private, owner account has 2-step verification, nobody else has edit access, version history reviewed.
- [ ] `ALLOWED_ORIGIN` = production origin; CSP `connect-src` is the exact Worker origin.
- [ ] WAF rate-limit rule on `/auth/*` and `/api`; Cloudflare/Apps Script alerts on errors.
- [ ] OAuth consent screen published (if public); only needed scopes.
- [ ] `AdminRoles` contains only intended admins.
## Operations
- [ ] Apps Script and Worker deployed from the same commit as the frontend; `npm test` green.
- [ ] Quotas understood (Apps Script runtime/URL fetch/mail, Sheets size, KV, Workers) and a plan for outgrowing Sheets.
- [ ] Backup + restore rehearsed. Test accounts and test data removed.
- [ ] Tested on Chrome, Firefox, Safari, Android and iOS, including sign-in, export, deletion, print.
- [ ] Keyboard and screen-reader pass on calendar, journal and forms.
