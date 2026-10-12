Hosted check on 2026-10-12: deployment dpl_AWfasZzgj3YUK1BL1ByrxCiqv4Em is READY for e9f221aa2c79d8bdd40075655e5022c1541c5677; actual API config returns **503 SERVICE_NOT_CONFIGURED**. GitHub Checks run 38183724491 is success. Secure login result remains unknown after the request and the required fresh browser verification both timed out. Release has not been merged or declared playable.

# Public release candidate — 2026-10-11T23:14:10.969186+00:00

The user now authorizes public GitHub/Vercel release after verification. Windows superprompt skill was unavailable; the execution brief is docs/SUPERPROMPT.md. This checkpoint does not claim a successful hosted backend test.

- `npm test`: **40 passed, 0 failed**. Includes dealing property matrix, scoring/ties and pauses, actual HTTP/private-photo access, 12 concurrent players, lost-response recovery, fresh-server persistence, quotas under concurrency and retries, same-origin/JSON guards, scoped photo proofs and expiry/generation checks, authenticated cron and conditional cleanup protecting live games.
- GitHub Checks run `38183579795`: completed / success on runtime commit `90262609393b7c67e30100c8685fd2cbb68290bc`; pinned official checkout/setup-node v6, Node 24, npm ci/test/build.
- `npm run build`: PASS. Public guide, metadata, robots, sitemap, manifest and icon are included. No server keys are bundled into the client.
- `npm audit`: 0 reported vulnerabilities. Source scan found no service tokens or private keys.
- `node test/browser-e2e.mjs`: PASS, 4 mobile contexts / 12 turns / 12 checks / 0 browser errors. Each hand has all three other authors; question/undo are immediate; result confirmation cancels correctly; reconnect, scoring, scoreboard and replay pass.
- `node test/photo-e2e.mjs`: PASS, 2 mobile contexts / 2 turns / 7 checks / 0 browser errors. Real picker survives autosave; both photos reach recipients and referees, landscape/reload and final photos pass. A valid nearly expired photo link renews on unchanged-state polling without replacing the text editor.
- `node test/lobby-e2e.mjs`: PASS. Lobby/play kick, transfer, creator/manager closure, leave, cancellation and rejection of former credentials are covered.
- `node test/background-e2e.mjs`: PASS, 3 mobile contexts / 5 checks. Creator app fully unloads for 48 seconds; guests keep saving text/photos, can claim management, and the server restarts without lost data. Creator remains away during another player's active turn; timer/question/score continue; all finish with photos and scoreboard.
- Public-home check: PASS at 320/390/768/1200px, including expanded guide, correct public links and metadata/assets. Mobile heading is readable without illustration overlap; screenshot visually inspected.

All browser tests above use real HTTP requests and a **durable local disk SDK adapter**. They are not evidence that Vercel Blob is provisioned. No process-memory/phone fallback exists in production.

Hosted release gate: current Vercel connector returns 403 for private Blob creation and project-environment access. No CLI credentials exist; the browser currently shows the Vercel sign-in page. The private store, Preview/Production binding and CRON_SECRET still need setup through authorized access, followed by the real hosted game tests. PR #1 remains draft; master and the old live deployment remain unchanged until this gate passes. CI is added for ongoing unit/HTTP tests and build on pull requests.

---

# Unmerged server/dealing/confirmation upgrade — 2026-10-10T22:18:28.651527+00:00

Runtime source: 75063babd6ba36c8d74c939255724cde6596e508; feature branch `fix/independent-lobby-host`; draft PR #1. Production/master are unchanged. The final source checkpoint adds only test diagnostics and these records.

`npm test`: 32 passed, 0 failed. Matrix covers 2–12 players, 1/2/3/5/20 cards, 20 seeds, unique cards, no own cards and even author counts. The reported four-person/three-card case gets exactly one card from each other author and varied deals between random seeds. HTTP tests use a fresh request-local BlobStore with a durable disk SDK adapter; 12 simultaneous joins/readiness/card writes, persisted private photos, fresh-server recovery, creator leaving and idempotent lost-response retries pass.

`npm run build`: PASS. Client JavaScript 33.69 kB (11.86 kB gzip), no PeerJS dependency.

Final browser checks use actual HTTP, isolated mobile contexts and real uploaded image bytes. Production has no disk or in-memory fallback.

- browser: PASS; 12 checks; 0 browser errors.
  - 4 mobile browsers join with a six-digit code and mark ready
  - empty required card text is rejected in the actual UI/API
  - browser photo compression, durable server storage and authenticated rendered photo
  - accidental correct tap opens confirmation; cancel and Escape leave score and turn unchanged
  - landscape overhead view; undo; pause freezes time; player reload retains identity
  - creator reload preserves the durable room without stopping the group
  - failure needs confirmation; question and undo stay immediate
  - each of the four players receives exactly one card from each of the other three authors
  - 12 turns; each card used exactly once; no own card dealt; scores and final scoreboard correct
  - replay returns all 4 players to a clean lobby
  - all players can leave after replay and create an independent fresh lobby
  - no uncaught browser errors or horizontal overflow in tested mobile views
- photo: PASS; 6 checks; 0 browser errors.
  - creator photo selection survives autosave/heartbeat while native picker is open
  - guest photo selection survives autosave/heartbeat while native picker is open
  - turn 1: other author's photo rendered on recipient and referee, including landscape view
  - recipient reload retrieves the current photo again
  - turn 2: other author's photo rendered on recipient and referee, including landscape view
  - both photos remain on completed cards and scoreboard for both players
- lobby: PASS; 4 checks; 0 browser errors.
  - manager kicks a lobby guest and the guest returns home immediately
  - confirmed mid-game kick resets remaining players to a clean two-person lobby
  - original creator can close after transferring management; all connected players return home
  - transferred manager can close; original host leaves cleanly; a fresh independent lobby works
- background: PASS; 5 checks; 0 browser errors.
  - both guests save real text and uploaded photos while the creator app is fully unloaded
  - after 48 seconds away, cards still save and another player can take management
  - a fresh server reloads the room and photos from disk without a creator connection
  - the creator can remain away during other players turn; time, questions and scoring keep working
  - all three players finish and receive the complete scoreboard and photos

The photo regression's final standalone run passes. An earlier concurrent run failed when the observer returned an intermediate writing snapshot; the observer now reports phase/UI context if this recurs. The creator-away runner was corrected to open the collapsed completed-card list before checking lazy images, and the final full run passes.

Hosted verification is PENDING: the native Vercel connector returns 403 on private Blob creation (also with explicit project ID), so no store/token/Production setting was changed. Browser fallback currently displays Vercel sign-in. The feature preview builds successfully but cannot create a room without its server token. Provision PRIVATE Blob for this preview, then run selected E2E on that exact deployment before claiming hosted success. Merge/promotion require the user's explicit instruction.

---

# Verified release

Verified at 2026-10-10T20:43:23.759915+00:00.
Playable URL: https://rooye-pishooni.vercel.app/
Production source commit: 1099f190c02323d36d52b6169dca49be174d49d4.
Vercel deployment: dpl_bPV2GuAVJN5YdyZmmg9jeM9XSs1p (production, READY).

`npm test`: 19 passed, 0 failed. `npm run build`: passed.
`E2E_URL=https://rooye-pishooni.vercel.app node test/browser-e2e.mjs`: passed.

Four isolated mobile Chromium contexts, 12 complete turns, actual public PeerJS signaling and native encrypted WebRTC. No fake host, signaling or data transport. The test observer reads authenticated peer RPC projections over the network.

- 4 mobile browsers join with a six-digit code and mark ready
- empty required card text is rejected in the actual UI/API
- browser photo compression, durable phone storage and rendered photo over WebRTC
- landscape overhead view; undo; pause freezes time; player reload retains identity
- creator reload restores the durable room, pauses time and reconnects the group
- 12 turns; each card used exactly once; no own card dealt; scores and final scoreboard correct
- replay returns all 4 players to a clean lobby
- all players can leave after replay and create an independent fresh lobby
- no uncaught browser errors or horizontal overflow in tested mobile views

No uncaught browser errors or horizontal overflow in the tested mobile views. Home and referee views were also visually inspected. This verifies browser contexts, not four physical phones. The runner's loopback ICE permissions/flags are testing setup only; the app never requests camera/microphone permission.

Playing requires Internet and the original creator phone's page to remain open and awake. Shared Wi-Fi is recommended. Creator recovery uses the same browser's IndexedDB; clearing it removes that room. No service accounts, environment variables, database or laptop are required.

Later documentation-only commits preserve this tested runtime.

## Photo picker regression fix

The previous immediate-upload test missed an open native picker outliving an autosave/heartbeat rerender. A new two-player regression test failed on the old code (no author preview after selection) and passes locally on the fixed code. It verifies photo upload from both players, images on the other player's overhead card and referee screen, recipient reload, and both photos in the final deck. Core tests: 19 passed. Build: passed. Final hosted photo regression check: PASSED on the stable game URL.

Verified at 2026-10-10T21:00:37.557659+00:00.
Runtime source: 20a83aecf6e2decc271bb95c64c0633a0aa887d1.
Production deployment: dpl_9mixoHwyjQevRjXKkHaYuDzVtsmD, READY.
Command: `E2E_URL=https://rooye-pishooni.vercel.app node test/photo-e2e.mjs`.

- creator photo selection survives autosave/heartbeat while native picker is open
- guest photo selection survives autosave/heartbeat while native picker is open
- recipient reload retrieves the current photo again
- turn 1: other author's photo rendered on recipient and referee, including landscape view
- turn 2: other author's photo rendered on recipient and referee, including landscape view
- both photos remain on completed cards and scoreboard for both players

Zero uncaught browser errors. No horizontal overflow. No physical phones were used by this test. Later documentation-only commits preserve the verified runtime.


## Lobby management and creator exit

Verified at 2026-10-10T21:26:07.810Z.
Runtime source: 77b764fa9a441376e227dd55c03bcebc51f66dc8.
Production deployment: dpl_D1ChTqRteUPPZMstTsLsmDYZkS4a, READY, stable URL https://rooye-pishooni.vercel.app/.

`npm test`: 25 passed. `npm run build`: passed.
`node test/browser-e2e.mjs`: PASSED with four mobile browser contexts and all 12 turns over actual public PeerJS/native WebRTC, including photo transfer, undo/pause, guest and creator reload, scores, replay and leave/recreate.
`E2E_URL=https://rooye-pishooni.vercel.app node test/lobby-e2e.mjs`: PASSED with three mobile browser contexts over actual public PeerJS/native WebRTC.

- manager kicks a lobby guest and the guest returns home immediately
- confirmed mid-game kick resets remaining players to a clean two-person lobby
- original creator can close after transferring management; all connected players return home
- transferred manager can close; original host leaves cleanly; a fresh independent lobby works

Zero uncaught browser errors and no horizontal overflow in both browser runs. New rule/service tests cover manager permissions, original creator protection, confirmed kick/reset, legacy creator identity, closure persistence and leaderboard sum of successful and failed turn durations. Ranking is total points descending, then total completed-turn time ascending, excluding pause and countdown. Exact score/time ties share rank. All clients should refresh before using the new controls. Later documentation-only commits preserve this verified runtime.
