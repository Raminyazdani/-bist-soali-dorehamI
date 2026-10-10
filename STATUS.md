# Resume checkpoint — 2026-10-10

Playable game: https://rooye-pishooni.vercel.app/
Repository: https://github.com/Raminyazdani/-bist-soali-dorehamI
Default remote branch: master. User authorized implementation, setup, tests, source sync and deployment. No more account setup is needed. Keep the scope to this friends-only mobile game; no subagents were requested.

## Finished product

Persian mobile UI; six-digit lobby; 2–12 players; 1–20 cards each; text required and optional compressed photo; all-ready phases; random player order and balanced unique dealing with no own cards; 20-question counter; referee controls; undo; pause; stopwatch; score/time ranking; scoreboard with authors; replay; reconnect and creator recovery.

Vercel static hosting + public PeerJS signaling + encrypted native WebRTC. The original creator phone is the authoritative host and stores rooms/photos in IndexedDB. Its page must stay open and screen awake. A manager transfer does not move the physical host. Creator reload pauses/restores the game and guests reconnect with stable credentials. No environment variables, database, service keys, signup or laptop while playing. Shared Wi-Fi is recommended.

## Verification

19 core/service tests pass and production build passes. Actual public-cloud WebRTC E2E passed with four isolated mobile browser contexts and 12 turns at the hosted URL. It covers a real large photo, no own/duplicate deal, readiness, 20-question failure, undo, pause, guest reload, creator reload/recovery, final scores and replay. No uncaught browser errors or horizontal overflow. The final expanded local run also passed leave/recreate and late-snapshot cleanup. Final release deployment is being checked with the same hosted test; record its result in VERIFICATION.md.

Test setup only: this runner has loopback interfaces, requiring Chromium allow-loopback and granted media permissions for ICE. The application itself never requests microphone/camera permissions. Test observers make authenticated peer RPCs over the actual network, without reading private host state or mocking signaling.

## Deployment and persistence

Linked Vercel project rooye-pishooni, id prj_5ZbepebkVmFbJdiLzdiWlsArSypK, team team_t1y5QDuakPdppOy5zuZLx66A; connected to the exact repository above, master production branch. Stable public alias is rooye-pishooni.vercel.app. Authentication protection is disabled for this game.

Use native GitHub tree/commit/ref tools to sync when CLI credentials are unavailable. Update master with an expected-head lease, never overwrite another user's changes. Native Vercel Git-source deployments use repository id 1413603466. The obsolete bist-soali-dorehami project is an unconfigured prior architecture and is not the game URL. Do not restart old browser login or service provisioning.

Commands: npm ci; npm test; npm run build; node test/browser-e2e.mjs; E2E_URL=https://rooye-pishooni.vercel.app node test/browser-e2e.mjs.

Future edits: read AGENTS.md and this file, keep changes minimal, verify actual multiplayer flow when transport/shared state changes, and persist source here. No secrets in repository.
