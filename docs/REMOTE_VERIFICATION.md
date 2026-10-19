# Remote-play verification — 2026-10-19 (Europe/Berlin)

Status: complete. Same app/repository/project and free backend under the direct remote-play request; no paid upgrade/trial/payment, new provider/schema/env binding or voice/video transport.

Candidate: `2bfe3abb9c99851193f0439473a973db3ace5b5f`. [PR 4](https://github.com/Raminyazdani/-bist-soali-dorehamI/pull/4) merged normally at 19:30:41 UTC / 21:30:41 Berlin as `b9d627697a9944e09336a6ff41d5dd5cbe6bd295`; full source diff zero. [Candidate CI](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/39310847969) and [master CI](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/39311596367) passed. Tested stable https://rooye-pishooni.vercel.app/ resolved during verification to READY `dpl_HFrqU1rZEnXyFBQSgwMHFS7kFE2j`, unique https://rooye-pishooni-bwe4zpbyr-ramin-yazdanis-projects.vercel.app/.

## Contracts and unit/provider checks

remotePlay is strictly boolean/default false for new, no-settings legacy and existing three-setting rooms. Host/lobby only, readiness reset, locked from writing, retained by replay. During waiting every player's card is null. With remote mode on, the active guesser's turn.card stays null through future-start countdown, running, pause/resume and referee changes, including creator/host-as-guesser. The same snapshot authorizes direct photo reads. Result/finished reveal normally; default physical behavior remains.

Seven remote tests passed after five failures/two passes before implementation. Full exact-candidate units: 127 total/126 PASS/one explicit live-provider skip; build Vite 8.3.4 PASS, manifest 2bfe3abb9c99. Real local HTTP tests deny even correctly guesser-signed photo proofs in all active phases with PHOTO_HIDDEN; observer/result/finished photos return 200; tampered proof 403 and invalid session 401. Full/changed-revision/action/duplicate-action/compact responses and settings validation/replay are covered.

Separate actual Neon: 43 PASS, 12 concurrent participants, exact 614,400-byte private photo, zero owned fixture leftovers, 21:25:19.909–21:25:25.654 Berlin (5.75 seconds). This is distinct from the intentional unit-suite skip.

## Exact native Windows — all six PASS

Clean isolated candidate worktree; Node 24.13.1/npm 11.13.0/native Chromium; real local HTTP/durable disk. Every gate exit 0, zero browser errors, unchanged assertions/timeouts/quotas.

| Gate | Checks / scope | Berlin interval | Seconds |
| --- | --- | --- | ---: |
| Units | 127 total / 126 PASS / one skip | 21:24:22–21:24:25 | 2.75 wall / 2.273 suite |
| Build/version | PASS / 2bfe3abb9c99 | 21:24:30–21:24:31 | 0.82 |
| Remote | 10, 3 contexts/3 turns/one room | 21:24:38–21:25:23 | 45.24 |
| Physical browser | 12, 4 contexts/12 turns | 21:25:29–21:26:44 | 75.32 |
| Photo | 7, 2 contexts/2 turns | 21:26:50–21:27:06 | 15.84 |
| Lobby | 4, 3 contexts | 21:27:15–21:27:35 | 20.55 |
| Background | 5, 3 contexts | 21:27:39–21:29:10 | 91.41 |
| Features | 8, 3 contexts/3 turns | 21:29:15–21:30:07 | 51.87 |

Total 46 browser checks. Remote monitor: 93 active-guesser snapshots including four action snapshots, zero privacy violations. Local conditional polls return full snapshots; compact behavior is separately hosted. Fresh portrait/landscape/scoreboard, physical forehead cards, settings/writing/confirmation, recovered draft/import/manual-update images were visually inspected, with contained RTL layout/no tested overflow. Earlier uncommitted remote run ten PASS at 21:22:07–21:23:01 is preliminary history, not substituted for this exact source.

## Actual Preview — PASS

Exact candidate, READY `dpl_sNEBa2JAUajLUHUizUcfuZr2UjYf`, https://rooye-pishooni-idubbfe9v-ramin-yazdanis-projects.vercel.app/. Actual version 2bfe3abb9c99 returned 200/no-store.

| Gate | Checks / scope | Berlin interval | Seconds |
| --- | --- | --- | ---: |
| Remote | 10, 3 players/3 turns/one room | 21:26:21.327–21:27:08.754 | 47.42 |
| Physical browser | 12, 4 players/12 turns | 21:27:16.125–21:28:38.252 | 82.12 |
| Photo + general privacy | 6 photo, 2 players/2 turns; 6 privacy | 21:28:45.578–21:29:04.285 | 18.70 |

All exit 0: 28 hosted checks plus eight privacy observations, zero browser errors. Remote audit: 50 active-guesser snapshots, three action snapshots, 62 compact replies, zero violations. Four creates fit the 21:20–21:30 fixed quota window; no extra smoke room. Exact deployment logs 19:26:21–19:29:15 UTC: successful query, zero error records/diagnostics.

The eight privacy observations comprise active/countdown correctly guesser-signed photo proof 403 PHOTO_HIDDEN, the exact same proof 200 after result, and the six general photo boundaries: authorized 200; invalid session 401; tampered signature 403; changed participant 403; valid-HMAC expired proof 403; anonymous private SQL 400. Hosted valid-proof visibility checks are these two observations; dedicated unit/local HTTP tests cover the full active-state matrix. No extra room/SQL query or persisted token/hash/path was used for these two observations.

## Tested stable Production — all six PASS

| Gate | Checks / scope | Berlin interval | Seconds |
| --- | --- | --- | ---: |
| Remote + active-photo privacy | 10, 3 players/3 turns/one room; 2 privacy observations | 21:31:26.707–21:32:12.630 | 45.91 |
| Physical browser | 12, 4 players/12 turns | 21:32:22.190–21:33:46.102 | 83.91 |
| Photo + general privacy | 6 photo, 2 players/2 turns; 6 privacy | 21:33:52.469–21:34:11.057 | 18.58 |
| Lobby | 4, 3 players | 21:34:19.350–21:34:39.235 | 19.88 |
| Background | 4 hosted checks | 21:34:55.250–21:36:30.695 | 95.44 |
| Features | 8, 3 players/3 turns | 21:36:42.828–21:37:35.239 | 52.41 |

All six exit 0: 44 hosted checks (10/12/6/4/4/8) plus eight privacy observations, zero browser errors; completed 21:37:35.239. Remote audit: 50 active-guesser snapshots, three active action snapshots and 64 compact replies, zero violations. Correctly guesser-specific HMAC proof returned 403 PHOTO_HIDDEN while active and the same proof 200 after result. Six general photo boundaries returned 200/401/403/403/403/400 as in Preview.

The successful whole exact-deployment log query for 2026-10-19T19:31:26Z–19:37:44Z returned zero error records/diagnostics (exit 0), including all six suites. Eight normal creates filled the 21:30–21:40 Berlin window: remote 1, browser 2, photo 1, lobby 2, background 1, features 1; the eight-per-IP-per-ten-minute quota remained enabled. No extra health rooms, unexpected failure, timeout, retry or weakened assertion occurred. Worktree ended clean at the tested merge, process-scoped E2E_URL removed.

The source/deployment identifiers above record tested artifacts. A later documentation-only build may have a different Git SHA/version while retaining this tested game runtime.

## Public/package/provider boundaries

Release-owner public check at 21:31 verified page/client/config/manifest 200, version b9d627697a99/no-store, client asset index-BJ7A8Oh3, security headers, no listed provider credentials in inspected public client, unauthorized cleanup 401 and image-import GET 405; zero health rooms. Daily 04:00 UTC cron remains enabled/deployed on the existing project; no new authenticated manual/overnight invocation is claimed.

Candidate audit: 64 tracked files, zero forbidden paths/listed credential formats; 24 runtime/config files, zero named credential literals. Dry package 21:27:31.757–21:27:34.213 (2.456 seconds): 65 entries = 63 regular files plus dist/test-output empty directory metadata, 534,937 bytes, 82 ignored, zero private/untracked/outside regular paths. Independent tracked/package scans are bounded, not universal secret-detection guarantees. Linked project/Node 24/Vite/build/dist verified; team billing Hobby at 21:27:35.883 Berlin. Release-owner fresh Neon evidence: available/active/free_v3/cost Free, no card requirement/exceeded quota, fra1, existing bindings.

Tests use mobile Chromium contexts, not physical phones. Native-only disk restart/proof renewal are not inflated into hosted counts. Secrets, rooms/photos, tokens/hashes/proofs/signed links and raw artifacts remain ignored/excluded. Free capacity is finite; existing mechanics, CAS/presence, private bytes, quotas, drafts/import/update safety and 24-hour expiry remain. Prior 12 October releases/failures stay historical in ../VERIFICATION.md.
