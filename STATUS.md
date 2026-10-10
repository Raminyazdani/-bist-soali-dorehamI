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
