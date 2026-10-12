# Verification — 2026-10-12 (Europe/Berlin)

## Native Windows handoff baseline

Source f37f71d30a61555e1ba513fdb275bb2db07c0e9a; Node 24.13.1, npm 11.13.0, Chromium 141.0.7390.37. Completed around 19:46 Europe/Berlin.

| Check | Result |
| --- | --- |
| npm ci / Chromium install | PASS; audit reported 0 vulnerabilities |
| npm test / build | PASS; 42 tests |
| browser-e2e | PASS; 4 contexts, 12 turns, 12 checks, 0 browser errors |
| photo-e2e | PASS; 2 contexts, 2 turns, 7 checks, 0 browser errors |
| lobby-e2e | PASS; 3 contexts, 4 checks, 0 browser errors |
| background-e2e | PASS; 3 contexts, 5 checks, 0 browser errors |
| Visual inspection | PASS; RTL home/guide at 320/390/768/1280 px, landscape, scoreboard and confirmation |

These use actual HTTP and durable local disk, not cloud storage. They cover author balance, unique cards, photos/picker/autosave, cancel/Escape, question/undo/pause, reload, scoring, replay and management. Creator disappearance unloads the app for 48 seconds while guests save cards/photos and claim management; local server restart preserves data. Mobile browser contexts were used, not physical phones.

## Hosted defect and correction

Preview dpl_GvuHNis53yPRRdXx72Z2MAAXDVUN, source f37f71d, READY: config=200, unauthenticated cleanup=401. Browser test failed at the fourth join (BUSY); later suites stopped.

Four live private Blob payload sizes reproduced compressed JSON GET returning a weak ETag while put/head exposed the strong version; If-Match failed. Identity encoding on the same uncached GET returned a strong version and allowed CAS in every case. Only this verification's unique diagnostic fixtures were deleted.

Mutable JSON now requests identity encoding. New provider regression fails before the fix and passes after, including stale-write rejection and state preservation. Expanded native tests also reproduced transient Windows sharing errors during disk replacement; bounded retries fix only the local adapter.

- Corrected npm test: **43 passed, 0 failed**; safe-diagnostics revision: **44 passed, 0 failed**.
- Corrected build: PASS.
- Unchanged 12-player concurrent HTTP test: PASS after the Windows fix.
- git diff --check: PASS.
- Corrected native browser suites on e592ab1: PASS, 12/7/4/5 checks, zero browser errors.
- Corrected hosted Preview and public Production: pending.

Corrected Preview dpl_9shcGYrN4TYscPAaTWebYm2FPPLY resolved the weak-ETag defect: all four players joined and seven turns completed, including real photos, confirmations and reloads. An observer then received 503 SERVICE_UNAVAILABLE on a state read; the remaining suites stopped. Diagnostic Preview dpl_4XgEMbgf2Q64mYxDbx2FcVhM22FC failed at photo upload and identified generic BlobError without transport/GET status. Direct concurrent provider CAS diagnostics produced only expected precondition conflicts. SDK-only reason diagnostics now redact configured credentials, URLs, bearer/session/proof values and identifiers; non-SDK messages remain excluded. The expanded privacy regression and full 44-test suite pass. No retry/assertion was changed merely to bypass the failure.

## Release gate

Run four corrected native/hosted Preview suites with real private Blob and photo privacy negatives. Confirm exact PR head, green CI and clean secret scan before merge. Then verify actual text/photo/game/result/replay and creator absence on https://rooye-pishooni.vercel.app/. Private fra1 storage is bound to Preview/Production; Production CRON_SECRET protects cleanup configured at 04:00 UTC. A scheduled run has not been observed.

Credentials, room identifiers, signed photo URLs and raw test artifacts remain in ignored local files. Earlier PeerJS/WebRTC results are historical and do not verify this server-backed release.
