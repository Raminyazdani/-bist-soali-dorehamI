# Remote-play release — 2026-10-19

The remote-play release continues the same free project. Candidate `2bfe3abb9c99851193f0439473a973db3ace5b5f`, [PR 4](https://github.com/Raminyazdani/-bist-soali-dorehamI/pull/4), normal merge `b9d627697a9944e09336a6ff41d5dd5cbe6bd295` at 21:30:41 Berlin; zero source diff. [Candidate CI 39310847969](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/39310847969) and [master CI 39311596367](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/39311596367) passed. Tested stable READY deployment `dpl_HFrqU1rZEnXyFBQSgwMHFS7kFE2j` and primary alias were independently checked.

Units 127 total/126 PASS/one explicit live skip; seven remote tests PASS with executed pre-fix red evidence; build PASS. Exact native six suites: 46 checks PASS, zero browser errors. Actual Neon 43 PASS/zero owned fixtures; actual Preview 28 checks plus eight privacy observations PASS, zero errors/log diagnostics. Production: all six PASS, 44 hosted checks plus eight privacy observations, all exit 0/zero browser errors, completed 21:37:35 Berlin; successful exact-deployment logs 19:31:26–19:37:44 UTC returned zero records/diagnostics. Full exact-source tables, remote server/photo contract, log intervals, scope limits and failed attempts are in [docs/REMOTE_VERIFICATION.md](docs/REMOTE_VERIFICATION.md). No paid upgrade/trial/payment or new provider/schema/env binding; no new authenticated cron run is claimed.

---

The material below records earlier releases and failed attempts for their stated 12 October source/deployment; it does not claim remote-play verification or today's live metadata.

# Historical feature release — 2026-10-12 (Europe/Berlin)

Status: complete. All five stable Production suites passed: 34 strict hosted checks plus six privacy boundaries, zero browser errors, and zero error records/diagnostics in the successful complete deployment-log query. The same app/repository/project continues under the latest direct human feature authorization. Provider terms were already accepted; no payment, paid trial or upgrade was made.

Tested candidate: `00b37e3e3829dd0eab5daea4b161d54de32ab8dd`. [PR 3](https://github.com/Raminyazdani/-bist-soali-dorehamI/pull/3) merged normally at 22:52:14 Berlin (2026-10-12T20:52:14Z) as `652bb52e97e327f57e463545cd9c0c1bb84782d4`. Runtime-path diff from candidate to merge is zero. Stable https://rooye-pishooni.vercel.app/ resolves to Production `dpl_9eH3Mjg4KQbaTHsA9ndmBgN8edyC`, READY, unique https://rooye-pishooni-ve4bnk76c-ramin-yazdanis-projects.vercel.app/. [Candidate CI 38306260601](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/38306260601) and [merge CI 38307002723](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/38307002723) passed.

## Units and actual provider

| Gate | Observed result / provenance |
| --- | --- |
| Latest unit suite | 120 total, 119 PASS, one explicit hosted-fixture skip, zero failures |
| Latest build / manifest | PASS, Vite 8.3.4; native version 00b37e3e3829 |
| Focused feature subsets | 65 server, 14 importer-security, 10 pending-text, 3 image-import HTTP cases PASS; these are subsets, not additional full-suite totals |
| Separate actual Neon | 43 PASS on bd5389eed69120626378e492dd307c79e6a7794b, whose backend has zero diff from latest: 22:28:48.959–22:29:19.015 Berlin, 30.05 seconds, zero owned fixtures remain |

Live-provider checks include 12 concurrent participants, exact 614,400-byte private photo, CAS/version/presence/manager races, idempotency, compact reads, atomic quotas and scoped cleanup. They were not rerun on the follow-up client/test-only commits. Fresh metadata at 2026-10-12T23:01:11.0066493+02:00: Vercel team Hobby; Neon store_Sd3kFMmUOKStEBvc available, billing active, external ready, usageQuotaExceeded false, free_v3 / Free / cost Free, paymentMethodRequired false, fra1, Marketplace auth option false, one connected project. Existing Preview/Production bindings remain; no resource/env/schema/plan changes occurred. An earlier unavailable network probe remains a historical failed read.

SQL is authoritative. Server-only DATABASE_URL protects private bytea photos; membership/generation/expiry/card-visibility proofs remain enforced. Opaque version covers body/presence and is distinct from reducer revision. Compact rows authenticate/check presence but cannot enter CAS; mutations and photo-proof renewal reload full state.

## Latest native Windows — PASS

Exact 00b37e3, clean isolated worktree, Node 24.13.1/npm 11.13.0/native Playwright Chromium, real local HTTP/durable-disk adapter. All exit 0, with zero browser errors.

| Gate | Scope / checks | Berlin interval | Seconds |
| --- | --- | --- | ---: |
| Units | 120 total / 119 PASS / one skip | 22:46:01–22:46:03 | 2.22 wall / 1.810 suite |
| Build / version | PASS / exact version | 22:46:08–22:46:08 | 0.61 |
| features-e2e | 3 contexts, 3 turns, 8 checks | 22:46:15–22:47:04 | 49.01 |
| browser-e2e | 4 contexts, 12 turns, 12 checks | 22:47:18–22:48:29 | 71.01 |
| photo-e2e | 2 contexts, 2 turns, 7 checks | 22:48:41–22:48:56 | 15.36 |
| lobby-e2e | 3 contexts, 4 checks | 22:49:10–22:49:29 | 18.83 |
| background-e2e | 3 contexts, 5 checks | 22:49:36–22:51:10 | 94.21 |

Completion 22:51:10. Fresh mobile RTL home/settings/writing/import/draft, landscape text/photo, confirmation and scoreboard screenshots were visually inspected; content was contained and mobile checks reported no horizontal overflow.

## Actual Preview — exact-source provenance

Full five-suite Preview used preceding `bd5389eed69120626378e492dd307c79e6a7794b`, deployment `dpl_ERc1JvYtXt9eLiwWGYV1JCvTEVMU`, https://rooye-pishooni-pojb1j8y6-ramin-yazdanis-projects.vercel.app/. [CI 38304361274](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/38304361274) passed. Backend/API/game/Postgres files have zero diff through the later follow-ups. Every script exited 0 with zero browser errors.

| Suite | Scope / checks | Berlin interval | Seconds |
| --- | --- | --- | ---: |
| browser-e2e | 4 players, 12 turns, 12 checks | 22:31:11.490–22:32:51.833 | 100.34 |
| photo-e2e + privacy | 2 players, 2 turns, 6 photo + 6 privacy | 22:33:04.846–22:33:22.490 | 17.64 |
| lobby-e2e | 3 players, 4 checks | 22:33:44.614–22:34:06.719 | 22.10 |
| background-e2e | 4 hosted checks | 22:34:15.347–22:35:56.565 | 101.21 |
| features-e2e | 3 players, 3 turns, 7 checks | 22:36:06.129–22:37:08.310 | 62.18 |

Exact deployment logs 20:31:11–20:37:20 UTC: query exit 0, zero error records/diagnostics. Actual manifest/config 200/no-store; manifest bd5389eed691.

Latest affected Preview used `00b37e3`, deployment `dpl_6taWcd79Yd9h3cXJr6Uc3nYk12SD`, https://rooye-pishooni-9kyhbckof-ramin-yazdanis-projects.vercel.app/. Eight features checks, three players/three turns PASS, exit 0, zero browser errors, 22:46:22.660–22:47:17.109 Berlin (54.44 seconds). Actual manifest 200/no-store/00b37e3e3829; exact logs 20:46:22–20:47:25 UTC returned zero error records/diagnostics. This checks the added legacy-text migration and all prior feature stories. The unaffected four suites and 43 live-provider checks are not relabeled as reruns on this latest SHA.

The intervening `0a998fd` migration fixture stopped native at 22:42:41–22:42:46 (4.85 seconds) and Preview at 22:43:22.449–22:43:32.016 (9.56 seconds): one completed check, zero browser errors, empty textarea assertion. Its pagehide-only cache removal could be followed by the client's visibilitychange persistence. Test-only 00b37e3 seeds old storage once before first bind; product runtime is identical to 0a998fd. The strict expected text and assertions stayed unchanged. Both latest native/Preview eight-check passes confirm this was fixture lifecycle ordering, not a product migration failure.

## Stable Production — PASS

Exact merged 652bb52e / dpl_9eH3Mjg4KQbaTHsA9ndmBgN8edyC above, stable alias independently verified. Actual manifest/config returned 200/no-store; version 652bb52e97e3. All final gates exit 0 and retain original assertions/navigation deadlines/quotas.

| Suite | Scope / checks | Berlin interval | Seconds | Browser errors |
| --- | --- | --- | ---: | ---: |
| browser-e2e | 4 players, 12 turns, 12 checks | 22:53:37.092–22:55:07.453 | 90.36 | 0 |
| photo-e2e + privacy, resumed | 2 players, 2 turns, 6 photo + 6 privacy | 23:00:06.582–23:00:25.696 | 19.11 | 0 |
| lobby-e2e | 4 checks | 23:00:35.087–23:00:57.076 | 21.99 | 0 |
| background-e2e | 4 hosted checks | 23:01:03.906–23:02:42.776 | 98.87 | 0 |
| features-e2e + legacy text | 3 players, 3 turns, 8 checks | 23:02:50.146–23:03:49.394 | 59.24 | 0 |

Total 34 hosted checks plus six privacy boundaries; completion 23:03:49. Successful exact-deployment logs for 20:53:37–21:04:00 UTC: query exit 0, zero error records/diagnostics. The successful window covers the initial failed navigation and all resumed suites.

The first photo attempt at 22:55:17.063–22:56:00.563 (43.50 seconds) exceeded the unchanged 30-second page.goto deadline before room creation/upload/privacy; zero completed checks, exit 1. Stable homepage diagnosis also exceeded 10 seconds, then version returned 200 after 7.455 seconds; a release-owner helper reported UND_ERR_CONNECT_TIMEOUT before mutation. The initial 20:53:37–20:56:10 UTC log query exited 1; its empty parsed output did not prove zero errors. Connectivity recovered around 23:00 (homepage 200/151 ms, Vercel API 200/944 ms, GitHub 200/173 ms). The owner authorized the strict remaining-suite retry, which passed with unchanged source/limits. These initial failures remain recorded; later successful full-window logs resolve their missing evidence.

Normal Production creates totaled seven: two in 22:50–23:00, five in 23:00–23:10. Failed navigation created no room; no health-check rooms were added. Privacy reused existing photo-suite sessions.

| Privacy boundary | Preceding Preview bd5389e / latest Production 652bb52e |
| --- | --- |
| Valid participant photo | 200 / 200 |
| Invalid session token | 401 UNAUTHORIZED / 401 UNAUTHORIZED |
| Tampered signature | 403 INVALID_PHOTO / 403 INVALID_PHOTO |
| Tampered participant | 403 INVALID_PHOTO / 403 INVALID_PHOTO |
| Expired proof with recomputed valid HMAC | 403 INVALID_PHOTO / 403 INVALID_PHOTO |
| Direct private SQL without credentials | 400 / 400 |

## Cleanup, public boundaries and packaging

The official platform cron trigger at 20:53:38.226 UTC was accepted in 817 ms. Actual new-deployment /api/cleanup returned HTTP 200 at timestamp 1791838418404; unauthorized endpoint check returned 401 at 1791838414511. Daily 04:00 UTC cron is enabled. This proves the manually triggered platform run, not an unobserved overnight scheduled invocation.

Public checks at approximately 22:53 and 23:00 verified stable page/client/manifest/config 200, expected version/no-store, nosniff/DENY/no-referrer headers, no provider credentials in the inspected public JS, unauthorized cleanup 401 and image-import GET 405. They created zero rooms.

Read-only final audit 23:00:38–23:03:18 on clean merge 652bb52e: zero runtime-path differences from tested 00b37e3; 62 tracked files, zero forbidden private/environment/artifact paths. Dry packaging at 23:01:07–23:01:09 (2.33 seconds) passed: 63 entries = 61 regular files + two empty directory metadata entries, 475,618 bytes, 76 ignored entries. dist/test-output had no packaged descendants. Private contents/untracked regular files were zero. Tracked and packaged scans found zero listed credential formats; 30 runtime/source files had zero named nonempty credential literals. These bounded scans do not claim every conceivable secret format is detectable.

Quotas and assertions stayed enabled. Raw credentials, rooms/photos, session proofs, signed links, screenshots/logs remain ignored and excluded by .vercelignore. Tests used mobile Chromium contexts, not physical phones. Native disk-server restart and accelerated photo-proof renewal are separate checks; hosted counts correctly omit them. Feature details and executed regressions are in [docs/FEATURES_VERIFICATION.md](docs/FEATURES_VERIFICATION.md).

Free 1 GB storage / 100 CU-hours / 5 GB egress per month is finite. Changed state, reload/proof renewal, photos, cleanup/import/version requests consume resources. Compact SQL 4,361-byte / unchanged HTTP 893-byte measurements below belong only to historical 50f60243; current settings/referee metadata were not remeasured. Existing Neon rooms retain legacy rules; safe old-client text recovery is distinct from room settings and does not migrate old Blob/PeerJS rooms.

---

The following release and provider attempts are historical evidence for their stated source/deployment. They do not describe the current runtime or provide new authorization.

# Historical free-Neon baseline — runtime 50f60243

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
