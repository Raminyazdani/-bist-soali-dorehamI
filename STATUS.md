# Public release — latest user scope (2026-10-12, Europe/Berlin)

User now wants the game publicly presented on their GitHub and Vercel. Merge/publication are authorized after tests, replacing the earlier hold. Read docs/SUPERPROMPT.md for the concrete execution brief. The linked Windows superprompt skill is not available in this environment; do not claim it ran. No subagents requested.

Existing repository is already PUBLIC; GitHub admin/write access works. Remote feature head: 4b023e3eb320d225d3cbeb653af19f8b0ac7d342. Master: 9940265e51e619109cf06830dd76756dc4f26770. Draft PR #1 is available. Local tree has the complete prior fixes and final local regression evidence; Public changes are implemented: rules/privacy guide, public metadata/assets, JSON/origin guards, durable creation/join/upload limits, scoped expiring photo URLs with renewal without editor rerender, conditional daily cleanup and a pinned minimal CI workflow. Room lifetime is 24 hours (LIMITS.roomHours), not 6 hours. 40 unit/HTTP/storage/security tests and build pass; npm audit reports 0 vulnerabilities. The 4-phone/12-turn HTTP browser game passes. Photo (including signed-link renewal), lobby controls and creator-background regressions now all pass; public home was visually checked and verified at four widths. See the latest VERIFICATION.md entry. Source is ready for a GitHub checkpoint and real hosted provisioning/tests.

Actual blocker: Vercel connector can inspect the project but listing its environment variables returns 403 (permission to list project environment variables denied). Prior private Blob creation also returned 403. No Vercel CLI, CLI auth files, VERCEL_* or BLOB_* runtime credentials are available. The earlier browserAuth request timed out; do not infer it submitted credentials or succeeded. The previous tab no longer exists. Fresh target-page verification shows Vercel sign-in in cloud browser tab 2. Complete all independent public-source changes and tests before requesting secure authentication again. Never ask for sign-in secrets in chat. Do not merge a backend without storage configuration.

Planned public additions: clear public README/home guidance, share/search metadata, lightweight CI, bounded entry/upload requests, private photo links without session tokens, and authenticated expiration cleanup. Preserve game behavior and existing fixes. The old notes below are historical; their no-merge instruction is superseded by the latest user request.

---

# Host-independent upgrade — feature branch, not merged

Branch: fix/independent-lobby-host. Base master: 9940265e51e619109cf06830dd76756dc4f26770. User explicitly said to finish the fix first and wait for their instruction before merging. Do not update master or publish/promote this upgrade to the stable game URL.

Implemented Vercel Functions + private Vercel Blob as the authoritative room/photo backend. Each phone sends authenticated HTTP requests independently; the original creator can leave the page without blocking others. Polls synchronize about every 1.6 seconds without replacing unchanged UI inputs. Creator can leave a lobby without closing it; logical management transfers normally. Existing scoring, readiness, private cards, timer/pause and admin rules are retained. The user also reported concentrated author pairs and accidental result taps: dealing now balances each recipient across every other author, with random card/order shuffles; correct, failed, reset, kick and closeRoom use an accessible native dialog with explicit confirmation, cancel/Escape, and stale-state dismissal. Question, undo and ordinary controls stay immediate. New v3 browser session keys deliberately start fresh rooms rather than accidentally resuming a peer-hosted room.

Current local verification: 32 rule/service/HTTP/storage tests and build PASS. Final actual 4-mobile-browser/12-turn game, 2-mobile photo picker regression, 3-mobile lobby controls and 3-mobile creator-disappearance flow all PASS with zero browser errors. Creator-away test fully unloads the app for 48 seconds during writing and 26 seconds while the creator is neither active player nor referee, and restarts the HTTP server while preserving rooms/photos. Confirmation cancel/Escape leave turns/scores unchanged; question/undo stay immediate; four players with three cards each receive all three other authors. Menus close on phase changes/management claim so they cannot cover play controls. Local tests use durable disk; private Blob and hosted preview are not verified yet.

Source checkpoint: 75063babd6ba36c8d74c939255724cde6596e508. Draft PR: https://github.com/Raminyazdani/-bist-soali-dorehamI/pull/1. GitHub feature ref is saved, master remains 9940265e51e619109cf06830dd76756dc4f26770. The preview auto-build is READY, deployment dpl_BjcNWATump6aqvS43WvPuPGGWSsX, but is NOT playable until its private Blob environment is configured. Do not present a successful static build as a verified backend.

Provisioning blocker: native Vercel create_storage_stores_blob returns 403 forbidden, with and without the explicit projectId. No Blob store was created, no token was obtained, no Production environment was changed. The current native connector cannot create this storage resource. A Vercel browser tab at the storage page redirects to sign-in; browserAuth documentation is read, but no sign-in values were read/entered and no auth request has been issued yet. Complete source/review checkpoint, then use secure browserAuth to obtain login and finish the private store/Preview-only environment setup if possible. Never ask for passwords/OTP in chat. Keep the existing live game untouched. No CLI Vercel credentials are available.

Target project: rooye-pishooni / prj_5ZbepebkVmFbJdiLzdiWlsArSypK, team team_t1y5QDuakPdppOy5zuZLx66A. Stable game: https://rooye-pishooni.vercel.app/. Connect a PRIVATE Blob store and BLOB_READ_WRITE_TOKEN to Preview for this branch first, then run E2E_URL on the preview. Production configuration and merge wait for the user. If sign-in cannot be completed, return the tested draft branch with the concrete hosted-verification blocker.

Use npm ci; npm run build; npm test; node test/browser-e2e.mjs; node test/photo-e2e.mjs; node test/lobby-e2e.mjs; node test/background-e2e.mjs. npm run dev serves the built app and real local API with durable disk in test-output/dev-rooms. API files are api/game.js and api/photo.js. Production never falls back to disk or a player's phone. The records below describe earlier shipped peer-hosted versions, not the feature branch architecture.

---

# Resume checkpoint — 2026-10-10

Playable game: https://rooye-pishooni.vercel.app/
Repository: https://github.com/Raminyazdani/-bist-soali-dorehamI
Default remote branch: master. User authorized implementation, setup, tests, source sync and deployment. No more account setup is needed. Keep the scope to this friends-only mobile game; no subagents were requested.

## Finished product

Persian mobile UI; six-digit lobby; 2–12 players; 1–20 cards each; text required and optional compressed photo; all-ready phases; random player order and balanced unique dealing with no own cards; 20-question counter; referee controls; undo; pause; stopwatch; score/time ranking; scoreboard with authors; replay; reconnect and creator recovery.

Vercel static hosting + public PeerJS signaling + encrypted native WebRTC. The original creator phone is the authoritative host and stores rooms/photos in IndexedDB. Its page must stay open and screen awake. A manager transfer does not move the physical host. Creator reload pauses/restores the game and guests reconnect with stable credentials. No environment variables, database, service keys, signup or laptop while playing. Shared Wi-Fi is recommended.

## Verification

19 core/service tests pass and production build passes. Actual public-cloud WebRTC E2E passed with four isolated mobile browser contexts and 12 turns at the hosted URL. It covers a real large photo, no own/duplicate deal, readiness, 20-question failure, undo, pause, guest reload, creator reload/recovery, final scores and replay. No uncaught browser errors or horizontal overflow. The final expanded local run also passed leave/recreate and late-snapshot cleanup. Final release deployment also passed the same hosted test, including leave/recreate. Full evidence is recorded in VERIFICATION.md. The game is complete and delivered; no outstanding setup or checks.

Test setup only: this runner has loopback interfaces, requiring Chromium allow-loopback and granted media permissions for ICE. The application itself never requests microphone/camera permissions. Test observers make authenticated peer RPCs over the actual network, without reading private host state or mocking signaling.

## Deployment and persistence

Linked Vercel project rooye-pishooni, id prj_5ZbepebkVmFbJdiLzdiWlsArSypK, team team_t1y5QDuakPdppOy5zuZLx66A; connected to the exact repository above, master production branch. Stable public alias is rooye-pishooni.vercel.app. Authentication protection is disabled for this game.

Use native GitHub tree/commit/ref tools to sync when CLI credentials are unavailable. Update master with an expected-head lease, never overwrite another user's changes. Native Vercel Git-source deployments use repository id 1413603466. The obsolete bist-soali-dorehami project is an unconfigured prior architecture and is not the game URL. Do not restart old browser login or service provisioning.

Commands: npm ci; npm test; npm run build; node test/browser-e2e.mjs; E2E_URL=https://rooye-pishooni.vercel.app node test/browser-e2e.mjs.

Future edits: read AGENTS.md and this file, keep changes minimal, verify actual multiplayer flow when transport/shared state changes, and persist source here. No secrets in repository.

## Mobile photo-selection fix — 2026-10-10

User reported a two-player game where a text/photo card (میلاد) reached the other player without its image. Reproduced a dropped file selection: autosave or a heartbeat rerenders the card input while the native picker is open, so the detached input's change event never reaches the delegated app listener. Fixed by binding the upload listener directly to each input; it survives detachment. No game protocol or saved-room format changed.

New test/photo-e2e.mjs reproduces the actual open-picker/rerender race and verifies both creator and guest photo uploads, other-player images in both turns, landscape, recipient reload, and all photos on the scoreboard via real public WebRTC. Before the fix it failed waiting for the author preview; after the fix the whole two-player local flow passes with zero browser errors. npm test (19) and build also pass. The image on Amin's forehead card labelled میلاد was visually checked. Final hosted release verification also passed on https://rooye-pishooni.vercel.app with two mobile browser contexts and zero errors. Verified runtime source: 20a83aecf6e2decc271bb95c64c0633a0aa887d1; production deployment: dpl_9mixoHwyjQevRjXKkHaYuDzVtsmD. The fix is live; players reload and reselect any previously dropped photo during card writing or their next game. No outstanding work.

## Lobby management fix — 2026-10-10
User confirmed the game works but requested kick, close/disband and creator exit. Implemented manager kick with immediate removal notification, protected original creator, and confirmation plus a clean game reset when removing someone after card creation. The logical manager and original creator can close a room in every phase; all connected players are returned home. Closed rooms cannot be joined/resumed/reset. Host closure lets final snapshots drain before destroying the physical peer. Manager controls are available on the overhead screen too. Leaderboard remains sum of points descending, then sum of every completed-turn duration (successful and failed) ascending; pause/countdown excluded.

25 rule/service tests and Vite production build passed. The new actual-public-WebRTC 3-player lobby E2E passed kick in lobby, kick during play, creator closure after transferring management, transferred-manager closure, all clients returning home and fresh lobby recreation. Final full 4-player/12-turn regression PASSED on the runtime source below, including photos, reconnect/reload, all turns, score/time ranking, replay and leave/recreate. Final 3-player lobby E2E PASSED on the stable production URL: lobby kick, confirmed mid-game kick, creator closure after manager transfer, transferred-manager closure and clean new lobby. Both reports contain zero browser errors; no horizontal overflow. Verified runtime source: 77b764fa9a441376e227dd55c03bcebc51f66dc8; production deployment dpl_D1ChTqRteUPPZMstTsLsmDYZkS4a (READY). Verified at 2026-10-10T21:26:07.810Z. All work is complete. All players should refresh to load the updated client before using the new controls.

The original execution environment became unavailable. Native Vercel Sandbox supplied a temporary runner cloned from this repository. Ubuntu 26 runner needs PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 for the existing pinned Playwright 1.56.1. This is only test infrastructure, not a game dependency. Use native run_session_command (structured command/args), cwd /vercel/-bist-soali-dorehamI; the one-off sandbox is stopped after verification and source sync. No secrets or new game services were added.
