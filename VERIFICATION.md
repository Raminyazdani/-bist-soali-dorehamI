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
