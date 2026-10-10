# Resume checkpoint — 2026-10-10

User goal: a working Persian mobile multiplayer party game today. User chose Vercel, no laptop server, minimal dependencies, and delegated implementation, setup, tests and deployment. User created this exact repository: https://github.com/Raminyazdani/-bist-soali-dorehamI.git. Connector confirms repository id 1413603466, default branch master, write/admin permissions, initially empty. Use this repository, not the earlier suggested name. No extra approval needed for ordinary code sync and deploying this game.

## Selected architecture

Cloud account sign-in from mobile blocked Supabase provisioning. Existing Vercel connector can create projects/deployments but integration, environment metadata and Blob creation returned 403. CLI is not signed in. Do not restart the expired Google authentication loop or retry those same rejected operations.

Pivot selected after real PeerJS public cloud signaling and encrypted native WebRTC passed a 500,000-byte round-trip between two isolated Chromium contexts at the HTTPS hosted origin. This is actual public signaling, not a fake transport. Test runner has only loopback interfaces: media permission and Chromium's allow-loopback flag are test environment setup only; the application never requests microphone/camera permission.

Vercel static hosting + PeerJS public signaling + the creator's phone as authoritative peer. Creator keeps page open and screen awake. Durable room state and separate photos stored in IndexedDB. Creator reload pauses and restores; guests reconnect with stable credentials. No account, environment variables or database service needed. Management transfer does not transfer the physical peer host.

## Completed

- Full lobby/card/turn/scoring/replay UI and shared rules existed before pivot. Previous implementation passed 20 core/service/SQL tests and a 4-mobile-context full 12-turn local PostgreSQL flow.
- Portable crypto refactor passed all those 20 tests. Shared rules do not use Node-only APIs now.
- Peer transport, serialized authoritative requests, filtered projections, photo caching, IndexedDB persistence, creator recovery and UI integration implemented. Build passed. Real public-cloud peer E2E passed with four mobile contexts and 12 turns, photo transfer, readiness, undo, pause, player reload, scores and replay. An expanded test for creator reload and a larger photo is running next; do not claim the hosted production version playable yet.
- Vercel project prj_zdRCe1k29DujofXP7T3K11YnZHMO, team team_t1y5QDuakPdppOy5zuZLx66A, name bist-soali-dorehami, URL https://bist-soali-dorehami.vercel.app/.
- Last production deployment dpl_9qFHbG516aorS6i6ABtNqrU2kYB3 is old Supabase version and not playable (configured:false). Must replace with verified peer version.
- Source locally committed on main through 5e3f63e; active branch p2p-no-setup carries the pivot. Archive with Git bundle was saved before pivot. Native GitHub tools initialized master and synced the full source through d6386c857b91cfd9c77349ac3bd8056e2873db4e. Local origin is configured and fetch works.

## Remaining

1. Keep syncing tested changes to the provided GitHub repo. It is initialized and source is already persisted.
2. Unused Supabase setup/dependencies removed; prior implementation remains on local main and in the previously saved Git bundle. Current npm test passes 19 meaningful reducer/service tests.
3. Real peer browser E2E passed. Expanded creator recovery and large-photo coverage needs to pass. Test observers also use actual authenticated network snapshots; no direct private-host access or mock transport.
4. Now a remote repository is usable, use create_git_project for a linked project (the existing bare project cannot be reconnected by that tool), deploy and verify actual URL with real multiple clients. No environment setup required.
5. Sync final tested source/status to GitHub; link Vercel if available without blocking deployment. Deliver playable URL with creator-phone condition.

Do not request passwords or OTPs in chat. Do not display secrets. Do not claim tests passed before actual results. No subagents were requested.
