# Working on this game

Read STATUS.md to resume; the user has delegated implementation, setup and deployment. The target is a working game for a small group today. Account sign-in from mobile blocked extra service provisioning. Real public PeerJS signaling + encrypted WebRTC passed a 500 KB transfer, so the selected architecture is Vercel static hosting, PeerJS public signaling, and the creator's phone as authoritative host with IndexedDB persistence. The creator must keep the page open. Avoid unrelated features.

Persist changes with Git. Once the requested private GitHub repository exists, sync commits there. Keep secrets out of the repository. Do not claim an online game is playable until real multi-client WebRTC and the full game flow are verified. Never substitute a demo backend for the actual network transport.

Run meaningful tests for changes to rules or shared state. `npm test` covers the shared reducer and service rules. `node test/browser-e2e.mjs` must verify the selected real peer transport, with production flow also tested at the hosted URL. `npm run build` verifies deployment output. The host phone is the real production authority, not a fallback or a mock.
