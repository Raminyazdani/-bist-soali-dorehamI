# Configurable rules, drafts and URL photos — verified release

Date: 2026-10-12, Europe/Berlin. The latest direct human brief in [FEATURES_EXECUTE_FA.md](FEATURES_EXECUTE_FA.md) was completed on the same free Neon app/repository/project. No paid service, trial or rebuild. Tested candidate `00b37e3e3829dd0eab5daea4b161d54de32ab8dd` merged normally in [PR 3](https://github.com/Raminyazdani/-bist-soali-dorehamI/pull/3) as `652bb52e97e327f57e463545cd9c0c1bb84782d4` at 22:52:14 Berlin. Stable [game](https://rooye-pishooni.vercel.app/) uses `dpl_9eH3Mjg4KQbaTHsA9ndmBgN8edyC`, with zero runtime-path diff from tested candidate. [Candidate CI](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/38306260601) and [merge CI](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/38307002723) passed. Full exact tables/history are in [VERIFICATION.md](../VERIFICATION.md).

## Implemented contracts

- New room settings: questions 20, autoPause false, sharedControls true. UI question choices are 10/20/30; the server validates strict integers 5–30. Legacy rooms without settings retain 20/true/false. Host-only lobby setSettings accepts settings/cardsPerPlayer, clears readiness and locks after card creation starts.
- Shared controls permit members to start an all-ready group, advance completed turns and replay finished games. Mid-game reset/kick/close protections remain. Current referee or host can delegate; a non-guesser can claim after confirmed referee absence strictly over 20 seconds, without being host. The referee-online flag updates in full and compact responses; unknown/recent presence does not authorize takeover.
- Pending text is scoped by room/player/generation, restored only while writing/unready. Matching edit tickets and in-flight protection prevent stale responses/polls erasing newer text, including A(server)→B(in-flight)→A(local). Ready waits for drain. Lifecycle keepalive, immediate visible/pageshow/online sync and bounded retries preserve text without duplicated polling or stale-context writes. UI distinguishes server saved, saving and device-only awaiting connection; offline cache is not server success.
- Published-client legacy text imports only when the new scoped key is absent, for eligible own card IDs/string text at most 160 characters. Already confirmed text reconciles. The new scope is saved before only unchanged imported own legacy entries are consumed; foreign/newer entries remain. Empty {} records prior scope use after acknowledgement/drain/reset, so stale text cannot return. Existing/malformed scoped cache wins. No photo, proof, URL or token enters this new cache. Text-cache migration is distinct from legacy server settings and does not migrate old Blob rooms.
- POST /api/image-import authenticates session/card ownership/unready writing before and after fetch. Direct public HTTPS raster only; DNS results and every redirect are checked, with a validated-IP connection and TLS hostname verification. Server timeout 10 seconds, at most three redirects, effective response cap 3 MiB, 20 imports per 10 minutes per player. Valid bytes reuse existing client compression/private upload capped at 600 KiB. URL import is not automatically retried; the original URL is neither persisted nor hotlinked.
- VITE_APP_VERSION and no-store /version.json provide 60-second visible checks plus resume, with an eight-second abort timeout/no overlap. Matching version clears a stale notice. Refresh is explicit and blocked during active play, uploads, pending text, busy saves or unsaved lobby settings. Busy/job completion immediately updates eligibility; no forced mid-turn reload or discarded drafts.

## Observed evidence

| Check | Result / exact scope |
| --- | --- |
| Latest units / build | 120 total, 119 PASS, one explicit hosted-fixture skip, zero failures; build PASS |
| Focused server / importer / HTTP | 65 / 14 / 3 PASS; subsets of the suite |
| Pending-text regressions | 10 PASS; A→B→A and four new legacy tests have executed red/green evidence |
| Latest native 00b37e3 | All five PASS: browser 12, photo 7, lobby 4, background 5, features 8; zero browser errors; completed 22:51:10 |
| Preceding bd5389e Preview | All five PASS: 12/6/4/4/7, privacy 6; backend identical through follow-ups |
| Actual Neon on that identical backend | 43 PASS, zero owned fixtures, 22:28:48–22:29:19 Berlin (30.05 seconds); not relabeled a latest-head rerun |
| Latest affected Preview 00b37e3 | Features 8 PASS, 3 players/3 turns, zero errors, 22:46:22–22:47:17 (54.44 seconds); manifest 200/no-store |
| Latest merged stable Production | All five PASS: 12/6/4/4/8 = 34 checks, privacy 6, zero browser errors/all exit 0; completed 23:03:49 |
| Production log query | Exact deployment, 20:53:37–21:04:00 UTC, exit 0, zero error records/diagnostics |
| Actual public raster | gstatic fetch 30,320 bytes; real import/compression/private save/reload/recipient/final card passed native and hosted feature flows |
| Final clean runtime/package audit | 62 tracked files; 63 package entries = 61 regular files + 2 empty directories; zero private contents/listed credential formats |

Latest affected Preview: `dpl_6taWcd79Yd9h3cXJr6Uc3nYk12SD`, https://rooye-pishooni-9kyhbckof-ramin-yazdanis-projects.vercel.app/. Its logs 20:46:22–20:47:25 UTC had zero error records/diagnostics. Earlier full Preview used bd5389e / dpl_ERc1JvYtXt9eLiwWGYV1JCvTEVMU. The unaffected four suites/live-provider checks were not rerun on latest client/test-only follow-ups.

The eight feature checks cover settings/readiness/shared start, current-author old-cache migration/foreign isolation, API outage/reload/drain, private URL rejection and real public image ingestion, absent creator-referee with continued time and guest claim, ten-question scoring (9 points after one question across three turns), shared replay and safe manual update preserving room/identity. New/legacy settings and cache migration are separate compatibility contracts.

## Failures, fixes and precise limits

The A→B→A draft reversal was red before in-flight protection and green after. Four legacy tests failed before migration and passed after; they cover own-text recovery, eligibility/foreign/invalid isolation, current/empty scoped precedence and no resurrection, confirmed text and failed-storage preservation. The newer-lobby-edit fix uses submitted-draft identity and source review; no separate automated red/green test is claimed.

The initial feature E2E passed six core checks then exposed an update button still disabled after busy ended. Refreshing eligibility fixed it; the original 30-second assertion passed, with seven working-tree checks/zero errors at 22:24:29. Readiness/revision and lazy-thumbnail waits were test-only corrections. The 0a998fd legacy fixture failed on unload ordering; test-only 00b37e3 seeds old storage once before first bind. Product runtime remained identical and native/Preview eight checks then passed without weakening assertions.

Production initially stopped at a 30-second photo page navigation timeout before creation/upload/privacy; its first log query was unavailable. Connectivity recovery preceded the authorized unchanged-source retry. Remaining suites passed, and the successful full deployment-log query covers the initial interval. Exact failed/successful observations remain in VERIFICATION.md.

Six privacy boundaries passed (200/401/403/403/403/400). Manual new-deployment cleanup was HTTP 200; unauthenticated cleanup 401; daily 04:00 UTC is enabled, without an observed overnight-run claim. Fresh resource metadata at 23:01:11.0066493 Berlin confirms Free/active/available/card-not-required/quota-not-exceeded; Vercel remains Hobby.

Tests use mobile Chromium contexts, not physical phones. Native disk restart and accelerated proof renewal are separate from hosted creator absence. Quotas/assertions stayed enabled. Credentials, rooms/photos, private proofs/signed links and raw artifacts remain ignored/excluded. Free 1 GB / 100 CU-hours / 5 GB egress capacity is finite. Historical compact 4,361-byte SQL / 893-byte HTTP measurements belong to 50f60243 only; current settings/referee additions were not remeasured.

## Implementation basis

Validated destinations, IP-bound connections with hostname/TLS checks and controlled redirects follow [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). This is design context, not security certification.

The effective 3 MiB import response cap is below the platform's 4.5 MB Function request/response limit; final private upload stays at 600 KiB. [Vercel Functions Limits](https://vercel.com/docs/functions/limitations). Application-specific outcomes above come from actual local/hosted evidence, not those web sources.
