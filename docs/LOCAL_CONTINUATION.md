# Continue the existing game — 2026-10-12 (Europe/Berlin)

Current state: the server-backed runtime was tested, merged and deployed, but stable Production verification is **blocked by Vercel Blob usage-quota suspension**. The public game cannot create a lobby. STATUS.md and VERIFICATION.md supersede earlier cloud-login, unconfigured-store, draft-PR and no-merge handoff records.

Do not recreate the app, repository, Vercel project or private store. Preserve history/data. The latest user request authorized completing this same project through GitHub/Vercel setup, actual hosted tests, merge and public release. It did not authorize paid upgrades/trials, quota bypasses or a backend rewrite.

## Current provenance

Repository: https://github.com/Raminyazdani/-bist-soali-dorehamI.git (leading hyphen, final capital I).
Owner: Raminyazdani. Default/production branch: master.
Merged PR: https://github.com/Raminyazdani/-bist-soali-dorehamI/pull/1.
Tested feature source: `5ff76753c0ef46985fc41ed18fb872e8cb87fdeb`.
Merge/master: `d8133895783c8cbbfa24316b852e303056cd6166`; master CI 38293010587 passed.

Vercel project: `rooye-pishooni` / `prj_5ZbepebkVmFbJdiLzdiWlsArSypK`.
Team: `ramin-yazdanis-projects` / `team_t1y5QDuakPdppOy5zuZLx66A`.
Region fra1; Vite, npm run build, dist, Node 24.
Stable URL: https://rooye-pishooni.vercel.app/.
Stable deployment: `dpl_DHsLuks9GoRY4qpaDjkjgRxAxb2B`, READY, runtime identical to tested head.
Passing Preview: `dpl_8riQogF9SmNQ4dYKx7F5Zh8iodUy`, https://rooye-pishooni-ekkxbd89p-ramin-yazdanis-projects.vercel.app.

Native Windows: 45 unit tests/build and four suites (12/7/4/5 checks) passed. Actual Preview: four suites (12/6/4/4 checks) and six privacy boundaries passed by 20:36:55. These are mobile Chromium contexts, not physical phones. Production first create returned 503 and authenticated cron trigger returned 503; remaining Production suites stopped.

## Resolve the proven blocker before new hosted attempts

Correct private store `rooye-pishooni-private` / `store_aI18UxfGKbZ3F7x1` is attached to Preview/Production, fra1. Authenticated v1 metadata proves limits-exceeded-suspended, billingState=suspended, usageQuotaExceeded=true and isTokenExpired=false, updated at 20:38:48.879. SDK GET is HTTP 403, `Your store is blocked`. This supersedes the initial auth/binding hypothesis. Read-only dashboard inspection states **access resumes 2026-11-11**. Own-store counters are below displayed allowances; which team/account usage category exhausted the quota remains unknown.

The account remains Hobby. A user decision is required about waiting for provider access to return or explicitly authorizing another hosting/cost approach. No paid upgrade/trial, payment/new terms, replacement store or backend redesign has been authorized/performed. Do not reset/delete data, create stores to bypass the quota, rotate working keys or repeatedly run blocked tests. STATUS.md links the official policy and records exact counters.

After the user decides and access is restored, verify actual project/store state, then run four complete stable-URL suites, six privacy boundaries and authenticated cleanup. Honor Retry-After; the six E2E lobbies and eight/IP/ten-minute creation limit must not be bypassed. READY/config200/unauthenticated-cleanup401 alone cannot prove the backend works. Record exact runtime/deployment and results; declare completion only after the stable public flow passes.

## Preserve implementation and local workflow

Backend: Vercel Functions + PRIVATE Vercel Blob, request-local BlobStore, durable authoritative state, uncached mutable JSON and atomic ETag writes. Mutable JSON requests identity encoding so body and strong version arrive together. Only the exact genuine SDK conditional-operation conflict enters the existing bounded fresh-state/CAS retry; unrelated errors propagate. Photos retain membership/card-visibility checks. No production process-memory, phone or disk fallback. Room lifetime is 24 hours; v3 sessions start fresh rooms rather than migrating peer-hosted lobbies.

GitHub and local Vercel CLI authentication were verified on this machine. Recheck current identity/team/project before mutations; never print credentials. Old /workspace paths, /tmp profiles, browser tabs, process IDs and pairing values are historical and not portable credentials. Preserve newer remote/user commits; no force push/reset, replacement repository or unrelated project.

Local prerequisites: Git, Node 24, npm, gh, Vercel CLI and Playwright Chromium. Run npm ci; npm run build; npx playwright install chromium; npm test; node test/browser-e2e.mjs; node test/photo-e2e.mjs; node test/lobby-e2e.mjs; node test/background-e2e.mjs. In PowerShell, set hosted targets with $env:E2E_URL; remove it inside local verification processes. Local tests use the durable disk adapter and do not prove cloud access.

Production CRON_SECRET and Preview/Production private storage bindings are configured. Sensitive env export may intentionally omit a value; do not overwrite working keys based on that alone. Daily cleanup is 04:00 UTC, but authenticated cleanup/scheduled success is unverified because storage is suspended. Keep secrets server-only, without VITE_ names. Never commit/print secrets, .env/.vercel auth, room/session data, test photos or signed links. .vercelignore explicitly excludes local/test artifacts from CLI uploads; inspect a deployment dry-run.

Keep the game minimal: preserve reducers/scoring, Persian mobile UX, author balance, confirmations, reconnect/management/creator-away behavior and private-photo protections. Public docs must distinguish successful Preview from failed Production/current provider suspension. Ask only for the concrete unresolved user decision; do not turn completed setup/testing into a coding checklist for the user.
