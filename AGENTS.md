# Working on this game

Read STATUS.md to resume. The user authorized implementation and tests but explicitly asked to wait for their instruction before merging this upgrade. Work on fix/independent-lobby-host; do not update master or promote a preview to production.

This branch replaces the original-phone/WebRTC host with Vercel Functions and private Vercel Blob. Keep the friends-only mobile game minimal. The existing reducers and scoring rules remain authoritative. Each HTTP request gets a fresh BlobStore; state reads bypass CDN cache and writes use ETag conditions. No authoritative process memory, phone storage or in-memory production fallback. Photos must stay private and be served through membership/card-visibility checks. Never expose storage tokens.

Run npm test, npm run build, the real HTTP multi-browser game, photo regression, lobby controls and background/creator-disappearance checks. Local development/testing uses a durable disk adapter; do not present local tests as verification of a hosted private Blob service. Before declaring a preview fully working, provision its private store and run the selected hosted tests. Preserve evidence in VERIFICATION.md.

Persist source and resume notes in the user repository Raminyazdani/-bist-soali-dorehamI on the feature branch. Use native GitHub tree/commit/ref tools if git push lacks credentials. Use expected-head leases, and never overwrite another user's changes. Existing peer-hosted lobbies are not migrated; publication starts fresh server-hosted lobbies after user authorizes merge.
