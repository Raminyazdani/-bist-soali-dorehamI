# Local continuation — 2026-10-12 (Europe/Berlin)

The existing repository, history, PR #1 and Vercel project were restored from the verified handoff. Public merge/release is authorized after real hosted verification. Local GitHub write/admin access and Vercel CLI authentication are verified; old cloud authentication notes are obsolete.

Project: rooye-pishooni / prj_5ZbepebkVmFbJdiLzdiWlsArSypK.
Team: ramin-yazdanis-projects / team_t1y5QDuakPdppOy5zuZLx66A.
Repository: https://github.com/Raminyazdani/-bist-soali-dorehamI
PR: https://github.com/Raminyazdani/-bist-soali-dorehamI/pull/1
Stable URL: https://rooye-pishooni.vercel.app/

Vite, Node 24, dist, fra1 and Git integration from master are retained. Private Blob in fra1 is connected to Preview and Production; server-only Blob credentials and Production CRON_SECRET are configured. Hobby plan retained without an upgrade. Cleanup is configured for 04:00 UTC; a scheduled invocation has not yet been observed.

Initial native Windows checks passed on f37f71d: 42 tests, build and four browser suites. Real hosted Preview then exposed compressed large JSON returning weak ETags, causing conditional updates to fail at the fourth join. Direct private Blob diagnostics reproduced this across four sizes. Mutable JSON reads now request identity encoding, obtaining the body and strong version atomically from the same uncached origin response; photo delivery is unchanged.

A provider regression fails on the old implementation and verifies large-state CAS plus stale-write rejection. Expanded native tests exposed transient Windows rename sharing violations; bounded Windows-only retries preserve atomic disk replacement. Production never uses that adapter.

Corrected unit/build: 43 tests PASS, build PASS. Fresh native browser reruns and corrected hosted Preview verification are in progress. This candidate is not merged or publicly released yet; master serves the previous architecture. See VERIFICATION.md.

Preserve game rules and the minimal architecture. No authoritative phone/process memory or disk fallback in production. Rooms expire after 24 hours; photos are private with server-checked card visibility. Earlier PeerJS lobbies are not migrated; the server release starts fresh v3 rooms.
