# Continue the free alternative — 2026-10-12 (Europe/Berlin)

Latest human request: activate this same game now through a free alternative, without a paid upgrade or waiting until November; audit/preserve mechanics. This supersedes the previous Blob-only/backend-freeze handoff. The human directly accepted Neon terms. Do not recreate the app or repository. No payment, paid plan/trial or Vercel upgrade was made/authorized.

## Current checkpoint

Candidate branch: fix/free-durable-storage. Exact candidate commit is not yet recorded. Full units: 77 total, 76 PASS, 1 explicit hosted skip; Vite 8.3.4 build PASS. Full native/new Preview/Production browser gates are pending. Stable https://rooye-pishooni.vercel.app/ still points at the suspended Blob-backed version and is currently unavailable.

Repository: https://github.com/Raminyazdani/-bist-soali-dorehamI.git (leading hyphen, final capital I). Existing Vercel project: rooye-pishooni / prj_5ZbepebkVmFbJdiLzdiWlsArSypK; scope ramin-yazdanis-projects; fra1; Node 24, Vite, npm run build, dist. Preserve Git history and current remote/user changes.

Neon resource store_Sd3kFMmUOKStEBvc / square-sound-46294634 is active, free_v3, fra1, cost Free, paymentMethodRequired=false. It is connected only to Preview/Production of this project, sharing the same database. SELECT 1 and a prior 43 live adapter checks passed; owned fixtures were fully removed. Latest-final-source live rerun is in progress. Focused crypto/game/poll: 47 checks PASS, including 4,400 dealing cases and 360 simulated turns; locked-ready and canonical/exact UUID regressions were corrected. These do not substitute for complete new hosted games.

## Implementation and safe setup

Vercel Functions use request-local PostgresStore for authoritative room JSON, presence, durable quotas and private bytea photos. Game revision tracks reducers; opaque version also tracks heartbeat to fence stale CAS decisions. Compact matching-revision SQL excludes heavy fields, authenticates and updates presence; full state is required before autoPause/write or photo-proof refresh. Preserve snapshot privacy, idempotent effects, confirmation controls, unbiased dealing, scoring/time rules, creator absence and 24-hour expiry.

Only DATABASE_URL is needed for database authentication; it must remain server-only. CRON_SECRET protects Production daily cleanup at 04:00 UTC. Initialize schema idempotently with node scripts/init-postgres.mjs followed by an explicitly supplied ignored env filename. Local development and ordinary local E2E use the durable disk adapter without provider credentials. Keep .env files, .vercel credentials, test data/screenshots and session/photo links out of Git and deployment uploads; .vercelignore and a dry-run are required.

Provisioned Free capacity is finite: 1 GB storage, 100 CU-hours and 5 GB egress. Conditional polls measured 4,361-byte SQL rows/893-byte unchanged responses in the synthetic maximum-card fixture; initial/changed state and photos remain larger. Do not promise unlimited capacity, authorize costs or silently reduce game limits. Original Blob store/data remain untouched and suspended; old Blob/PeerJS rooms are not claimed migrated. After release, players refresh and create fresh rooms.

## Execute through real activation

Record the exact candidate source and final counts. Run npm ci/test/build and full native browser/photo/lobby/background suites, then the explicit live Neon regression using only owned fixtures. Actual Preview must pass complete multiplayer text/photo/readiness/turn/scoring/replay, confirmations, privacy, reconnect, creator absence and authenticated cleanup. Do not infer backend success from READY/config200.

Use process-scoped E2E_URL for hosted tests and remove it for local tests. Honor Retry-After and the eight/IP/ten-minute create limit; do not weaken assertions/quotas or run broad cleanup against user data. Merge/deploy the exact tested head through the existing integration, then run all stable-URL suites plus privacy/cleanup and record source/deployment/time. Claim activation only after those gates pass.

GitHub/local Vercel authentication were verified on this machine; recheck current identity/team/project before mutation. Historical /workspace, /tmp profiles, processes, tabs and pairing values are not portable credentials. Use ordinary Git updates/expected-head leases; no force reset/push, replacement repository or unrelated project. Older Blob tests/status are history and must not block this newly authorized free continuation.
