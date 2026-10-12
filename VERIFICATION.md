# Verification — release blocked, 2026-10-12 (Europe/Berlin)

The final runtime passed native Windows and complete actual Vercel Preview verification, then was merged and deployed. Stable Production verification failed after Vercel suspended the private store for exceeded usage quota. The public game is currently unavailable; release completion is not claimed.

Tested source: `5ff76753c0ef46985fc41ed18fb872e8cb87fdeb`.
Merge/master: `d8133895783c8cbbfa24316b852e303056cd6166`.
PR: https://github.com/Raminyazdani/-bist-soali-dorehamI/pull/1
Stable URL: https://rooye-pishooni.vercel.app/
Production: `dpl_DHsLuks9GoRY4qpaDjkjgRxAxb2B` (READY; runtime matches tested source).
Feature CI: [38291118499](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/38291118499), PASS.
Master CI: [38293010587](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/38293010587), PASS.

## Native Windows — PASS

Windows, Node v24.13.1, npm 11.13.0, Playwright Chromium 141.0.7390.37 (build 1194). Final browser rerun used a clean isolated worktree at the exact tested source; E2E_URL was removed only inside each local test process.

| Check | Result | Final interval, Europe/Berlin |
| --- | --- | --- |
| npm test | PASS; 45 tests, 0 failures | Before final browser rerun |
| npm run build | PASS; Vite 8.3.4 | 20:28:34 |
| browser-e2e | PASS; 4 contexts, 12 turns, 12 checks, 0 browser errors | 20:28:44–20:29:56 |
| photo-e2e | PASS; 2 contexts, 2 turns, 7 checks, 0 browser errors | 20:30:05–20:30:20 |
| lobby-e2e | PASS; 3 contexts, 4 checks, 0 browser errors | 20:30:36–20:30:55 |
| background-e2e | PASS; 3 contexts, 5 checks, 0 browser errors | 20:31:04–20:32:38 |

These suites use actual HTTP with the durable local disk adapter. They cover mandatory text, real photos, balanced/unique assignments, confirmation/cancel/Escape, landscape, question/undo/pause, player/creator reload, scores/time ranking, scoreboard, replay and clean recreation. Photo tests reproduce picker/autosave races, link renewal, recipient reload and final images. Lobby tests cover kick before/during play, clean reset, transfer and closure. Background tests fully unload the creator, permit guest text/photo saves and takeover after 48 seconds, restart the local HTTP server with durable recovery, and continue questions/time/scoring while the creator remains away.

Baseline home/expanded-guide visuals passed at 320/390/768/1280 px without overflow; final home, landscape text/photo and sensitive-result screenshots were visually inspected. All tests use isolated mobile browser contexts, not physical phones.

## Actual Vercel Preview — PASS

URL: https://rooye-pishooni-ekkxbd89p-ramin-yazdanis-projects.vercel.app
Deployment: `dpl_8riQogF9SmNQ4dYKx7F5Zh8iodUy` (READY).
Source: `5ff76753c0ef46985fc41ed18fb872e8cb87fdeb`.
Backend: Vercel Functions/private Vercel Blob, fra1; real deployed requests, no local disk server.

| Hosted suite | Result | Interval, Europe/Berlin |
| --- | --- | --- |
| browser-e2e | PASS; 4 players, 12 turns, 12 checks, 0 browser errors | 20:29:54–20:32:54 |
| photo-e2e + privacy wrapper | PASS; 2 players, 2 turns, 6 photo checks plus 6 privacy boundaries, 0 browser errors | 20:33:24–20:33:56 |
| lobby-e2e | PASS; 3 players, 4 checks, 0 browser errors | 20:34:17–20:34:54 |
| background-e2e | PASS; 4 hosted checks, 0 browser errors | 20:35:06–20:36:55 |

The full game exercised concurrent join/readiness, required text, private photos, confirmation/cancel/Escape, undo/pause, reconnect/reload, all twelve balanced assignments/results, scoreboard, replay and leave/recreation. Photo tests covered both picker/autosave races, reload, landscape turns and final images. Lobby controls and creator-away guest writes, 48-second takeover, continued questions/time/scoring and final photos passed. The hosted suite does not perform the fifth local background check, local server restart. The seventh photo check, accelerated signed-link renewal, is local-only.

| Room-free privacy boundary | Observed result |
| --- | --- |
| Valid participant photo | HTTP 200 |
| Invalid participant token | HTTP 401, UNAUTHORIZED |
| Tampered photo signature | HTTP 403, INVALID_PHOTO |
| Tampered photo player | HTTP 403, INVALID_PHOTO |
| Expired proof with recomputed valid HMAC | HTTP 403, INVALID_PHOTO |
| Direct private Blob URL without authentication | HTTP 403 |

Privacy checks reused normal photo-suite responses in memory without extra rooms. Six lobbies were created across the suites; quotas/assertions stayed enabled. Read-only runtime logs for 18:29:54–18:37:00 UTC contained zero backend errors/diagnostics. E2E_URL was process-scoped and removed afterward. Completion at 20:36:55 proves operation then, not continued availability after suspension.

## Stable Production — FAIL / BLOCKED

PR #1 merged the exact tested head at 20:44:59. Git-source master deployed with zero runtime difference from the passing Preview. Config returned HTTP 200 and unauthenticated cleanup HTTP 401; neither proves a complete live game.

| Check | Observed result |
| --- | --- |
| browser-e2e, 20:47:44–20:48:20 | FAIL, exit 1, 35.98 s; initial creator request returned 503 SERVICE_UNAVAILABLE |
| Completed checks / turns / browser errors | 0 / 0 / 0; no successfully created lobby observed |
| Photo/privacy, lobby, background | Not started after first failure |
| Authenticated platform cron trigger | HTTP 503; cleanup not verified |

The initial browser timed out at test/browser-e2e.mjs:49 waiting for [data-action=readyLobby]. Read-only runtime logs for 18:47:44–18:48:25 UTC recorded two backend 503 responses with genuine SDK BlobError, Blob GET HTTP 403, `Vercel Blob: Failed to fetch blob: 403 Forbidden`. Authenticated cleanup also failed at storage access. The initial authentication/binding hypothesis was superseded by authoritative store evidence.

Authenticated v1 metadata returned `status=limits-exceeded-suspended`, `billingState=suspended`, `usageQuotaExceeded=true`, `isTokenExpired=false`, and correct Preview/Production binding for private `store_aI18UxfGKbZ3F7x1` / `rooye-pishooni-private`, fra1. Its `updatedAt=1791830328879` is 20:38:48.879 Europe/Berlin, after Preview completion. Direct SDK GET returned HTTP 403, `Your store is blocked`. Read-only dashboard inspection states access resumes **2026-11-11**. Own-store counters are below the displayed included allowances; the exact exhausted team/account quota category has not been established. STATUS.md records the counters, current [official Hobby policy](https://vercel.com/docs/vercel-blob/usage-and-pricing) and required user decision.

Production CRON_SECRET is configured. Sensitive env export intentionally omits the value and does not prove an empty runtime key. Daily cleanup is configured at 04:00 UTC, but no successful authenticated cleanup or scheduled run is claimed. No paid upgrade/trial, payment/new terms, replacement store, reset/deletion or key rotation occurred. Blocked tests are stopped pending a user decision/provider-state change.

## Earlier failed attempts and corrected boundaries

| Exact source / deployment | Observed failure | Correction or outcome |
| --- | --- | --- |
| f37f71d30a61555e1ba513fdb275bb2db07c0e9a / dpl_GvuHNis53yPRRdXx72Z2MAAXDVUN, 19:46:26–19:47:52 | Fourth join remained BUSY; 0 turns | Four live large-JSON sizes failed CAS with compressed weak ETags and passed identity reads; retain body/strong version in one response and reject stale writes. |
| e592ab181f5345cbf9d6ed977182170ec7459ebd / dpl_9shcGYrN4TYscPAaTWebYm2FPPLY, 20:00:42–20:02:33 | State HTTP 503 after 7/12 turns | Added bounded sanitized diagnostics; assertions/retries unchanged. |
| d715588f0d893ed64a1240089b49a4b8d84c7728 / dpl_4XgEMbgf2Q64mYxDbx2FcVhM22FC, 20:10:21–20:11:06 | Initial photo upload HTTP 503; 0 turns; 6 plain BlobError records | Continued exact provider diagnosis. |
| 5f2775b929b5d860815d8d16ee5aaf2ac8f0ce0a / dpl_GYUkfmTutbUA5ZZPrBUUXTcioCLo, 20:23:23–20:24:50 | State HTTP 503 after 4/12 turns | Genuine SDK BlobError's exact conditional-operation conflict needed narrow recognition in bounded fresh-state/CAS retry. |
| 5ff76753c0ef46985fc41ed18fb872e8cb87fdeb / dpl_8riQogF9SmNQ4dYKx7F5Zh8iodUy | All four hosted suites plus privacy passed | Corrected provider behavior verified in complete real play. |

Provider regressions failed before fixes and passed afterward. Conflict handling preserves a competing update, commits an action once, rejects stale body/version and propagates unrelated SDK errors. A separate Windows atomic-replace sharing violation was fixed only in the local disk adapter with bounded EPERM/EACCES/EBUSY retries; production behavior/concurrency assertions were unchanged. Test counts progressed 42 → 43 → 44 → 45; final verified runtime has 45.

Earlier PeerJS/WebRTC releases are historical and do not verify current server-backed code. Raw logs/screenshots and room/session/private-photo data remain outside committed reports in ignored test-output. .vercelignore excludes these and local env files from CLI uploads. Preserve the existing repository/project/store and rerun complete stable-URL suites, privacy and authenticated cleanup after access returns.
