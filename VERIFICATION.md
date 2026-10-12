# Free Neon release verification — 2026-10-12 (Europe/Berlin)

Status: complete. All four strict stable Production suites, six privacy boundaries, runtime-log review and authenticated manual cleanup passed. This is the same app/repository/project with a human-authorized free backend migration. Provider terms were accepted directly; no payment, trial or paid upgrade was made.

Tested runtime:50f60243e6eaeb9127440141dc42b249915a2074.
Merged PR:https://github.com/Raminyazdani/-bist-soali-dorehamI/pull/2.
Master:bf886026e0cf14e4cfb9cc6fe1babd4bd9bbd06a, merged21:41:36.
Stable:https://rooye-pishooni.vercel.app/.
Production:dpl_7vZEwopPXvCCnQw3QCNiiuU3GBwM, READY, runtime identical to tested head.
CI:[candidate38298355943](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/38298355943) and [master38299331031](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/38299331031), PASS.

## Logic and actual provider

| Gate | Verified result |
| --- | --- |
| Unit suite | 77 total:76 PASS,1 explicit hosted-fixture skip,0 failures |
| Build | PASS, Vite8.3.4 |
| Separate actual Neon fixture run | 43 checksPASS;12 concurrent players,614400-byte private photo exact, idempotency/CAS/presence/manager races, compact reads, atomic quotas and scoped cleanup;0 owned fixtures remain |
| Focused game/crypto/poll | 47 PASS;4,400 dealing cases and360 turns; locked-ready/canonical UUID regressions red before fixes and green after |

Neon resource store_Sd3kFMmUOKStEBvc / square-sound-46294634 is active/available,free_v3/fra1,costFree,paymentMethodRequired=false,usageQuotaExceeded=false at21:46:59. Only Preview/Production are connected, with the same database. Team billing remains Hobby. SQL is authoritative; DATABASE_URL stays server-only. Private bytea photos retain the existing HMAC generation/expiry/membership/card-visibility checks. Opaque version covers body and presence; game revision tracks reducer commits. Compact rows authenticate but cannot enter CAS; missing-participant autoPause reloads full state first.

## Native Windows — PASS

Exact50f60243 runtime, Windows/Node24.13.1/npm11.13.0/native Playwright Chromium; clean isolated worktree, real local HTTP/durable disk adapter.

| Suite | Scope / errors | Europe/Berlin interval |
| --- | --- | --- |
| browser-e2e | 4 contexts,12 turns,12 checks,0 browser errors | 21:32:59–21:34:11 |
| photo-e2e | 2 contexts,2 turns,7 checks,0 browser errors | 21:34:30–21:34:46 |
| lobby-e2e | 3 contexts,4 checks,0 browser errors | 21:34:59–21:35:19 |
| background-e2e | 3 contexts,5 checks,0 browser errors | 21:35:38–21:37:14 |

All exit0; buildPASS at21:32:48. Exact-runtime RTL home, confirmation, landscape text/photo screenshots were visually inspected and contained; automated mobile flows reported no horizontal overflow.

## Actual Preview — PASS

URL:https://rooye-pishooni-fbjxyxrt6-ramin-yazdanis-projects.vercel.app.
Deployment:dpl_ExgQdfKDLZtvHRXeE4xsQDdPEqeG, exact50f60243 source; real Vercel Functions/Neon requests, no local disk server.

| Suite | Scope / errors | Europe/Berlin interval |
| --- | --- | --- |
| browser-e2e | 4 players,12 turns,12 checks,0 browser errors | 21:33:48–21:35:18 |
| photo-e2e + privacy | 2 players,2 turns,6 photo checks+6 privacy,0 browser errors | 21:36:08–21:36:26 |
| lobby-e2e | 3 players,4 checks,0 browser errors | 21:36:59–21:37:19 |
| background-e2e | 4 hosted checks,0 browser errors | 21:38:05–21:39:39 |

All exit0. Runtime logs19:33:48–19:40:00UTC returned zero backend error records/diagnostics.

## Stable Production — PASS

Exact merged master/runtime above, strict unchanged suites on the stable URL.

| Suite | Scope / errors | Europe/Berlin interval | Seconds |
| --- | --- | --- | ---: |
| browser-e2e | 4 players,12 turns,12 checks,0 browser errors | 21:43:26–21:44:56 | 90.10 |
| photo-e2e + privacy | 2 players,2 turns,6 photo checks+6 privacy,0 browser errors | 21:45:12–21:45:30 | 17.65 |
| lobby-e2e | 3 players,4 checks,0 browser errors | 21:46:25–21:46:48 | 22.96 |
| background-e2e | 4 hosted checks,0 browser errors | 21:47:11–21:48:48 | 96.92 |

All exit0. Runtime logs19:43:26–19:49:15UTC returned zero backend error records/diagnostics. Production verification completed21:48:48.

| Privacy boundary | Preview / Production |
| --- | --- |
| Valid participant photo | 200 /200 |
| Invalid session token | 401 UNAUTHORIZED /401 UNAUTHORIZED |
| Tampered photo signature | 403 INVALID_PHOTO /403 INVALID_PHOTO |
| Tampered participant | 403 INVALID_PHOTO /403 INVALID_PHOTO |
| Expired proof with recomputed valid HMAC | 403 INVALID_PHOTO /403 INVALID_PHOTO |
| Direct Neon SQL without database credentials | 400 /400 |

The manual platform cron trigger at21:43:35.986 produced /api/cleanup HTTP200 at21:43:36.267 (1791834216267). Unauthorized cleanup returned401 at21:42:46.561 (1791834166561). Daily schedule0 4 * * * is deployed; this verifies manual authenticated invocation, without claiming an observed overnight scheduled run.

Full browser suites covered concurrent admission/readiness, mandatory text, real private photos, confirmation/cancel/Escape, question/undo/pause, landscape, player/creator reload, all12 balanced/unique assignments/results, score/time ranking, scoreboard, replay, clean recreation and lobby controls. Creator-away fully unloaded the creator, permitted guest writes/takeover after48seconds and continued time/questions/scoring/final photos. The local fifth background check restarts the disk server; hosted counts correctly exclude it. Accelerated signed-link renewal is the local seventh photo check; hosted photo counts correctly remain6.

Privacy checks reused normal photo-suite sessions without extra rooms. Quotas/assertions stayed enabled and E2E_URL was process-scoped. Tests use isolated mobile Chromium contexts, not physical phones. Raw credentials, rooms/photos, signed links and screenshots remain ignored/excluded by .vercelignore.

Free capacity is finite:1GB storage,100CU-hours and5GB egress/month. The synthetic maximum-card fixture measured compactSQLrow4,361 bytes/unchanged HTTP893 bytes. Changed state, initial/reload and photo-proof revalidation fetch full state; photo bytes/cleanup add usage. This is not an unlimited-capacity guarantee. Players refresh/start fresh rooms; old store/data were not deleted or claimed migrated.

## Historical Blob attempts — observations only

These records describe the previous provider/runtime, not current availability or instructions. The latest free-alternative authorization superseded Blob-only/wait restrictions.

| Previous source / deployment | Observed result |
| --- | --- |
| f37f71d /dpl_GvuHNis53yPRRdXx72Z2MAAXDVUN,19:46:26–19:47:52 | Fourth join BUSY; compressed weak ETag caused CAS rejection. Four large payload diagnostics failed compressed reads and passed identity reads. |
| e592ab1 /dpl_9shcGYrN4TYscPAaTWebYm2FPPLY,20:00:42–20:02:33 | State503 after7/12 turns; added bounded provider diagnostics. |
| d715588 /dpl_4XgEMbgf2Q64mYxDbx2FcVhM22FC,20:10:21–20:11:06 | Initial photo503,0 turns;6 plain BlobError records. |
| 5f2775b /dpl_GYUkfmTutbUA5ZZPrBUUXTcioCLo,20:23:23–20:24:50 | State503 after4/12 turns; exact SDK conditional-operation conflict required narrow CAS-retry recognition. |
| 5ff76753c0ef46985fc41ed18fb872e8cb87fdeb /dpl_8riQogF9SmNQ4dYKx7F5Zh8iodUy |45 units/build/native12/7/4/5 and hosted12/6/4/4+privacy6 PASS; Preview complete20:36:55. |
| d8133895783c8cbbfa24316b852e303056cd6166 /dpl_DHsLuks9GoRY4qpaDjkjgRxAxb2B | PR#1 merged; first Production create failed503 at20:47:44–20:48:20 (35.98s),0 turns; authenticated cleanup503; remaining suites stopped. |

Historical provider metadata proved limits-exceeded-suspended/billingState suspended/usageQuotaExceeded true/isTokenExpired false/correct binding, updated20:38:48.879 after Preview. SDK returned403, Your store is blocked; dashboard stated2026-11-11 return. Which team/account quota exhausted was not established. Original Blob store/data remain untouched. Prior PeerJS/WebRTC evidence is also historical and does not verify this Neon runtime.
