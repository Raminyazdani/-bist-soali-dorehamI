# Free Neon continuation — 2026-10-12 (Europe/Berlin)

The user now requests immediate activation through a free alternative, preserving this same app and mechanics. This supersedes the earlier Blob-only/wait-until-November restriction. The human accepted the new provider terms directly. No payment, paid plan/trial or Vercel upgrade was accepted.

Current candidate branch: fix/free-durable-storage. Its exact source checkpoint has not yet been recorded. Unit suite: 77 total, 76 PASS, 1 explicit hosted skip; Vite 8.3.4 build PASS. Full native browser, actual new Preview and stable Production verification are pending. The stable URL https://rooye-pishooni.vercel.app/ still runs the suspended Blob-backed version and is currently unavailable; the free candidate is not yet declared released.

## Verified new provider and candidate checks

Neon resource store_Sd3kFMmUOKStEBvc, project square-sound-46294634, plan free_v3, fra1, active. It is attached only to Preview and Production of the existing rooye-pishooni project; both environments use the same database. Actual SELECT 1 succeeded. Provider metadata shows cost Free and paymentMethodRequired=false.

Live Neon adapter verification: the prior 43-check run PASS, including 12 concurrent players, repeated actions/uploads, stale version rejection, heartbeat/presence fencing, compact reads, 600 KiB private-photo byte round trip, durable quotas and scoped cleanup; zero owned fixtures remained. Its latest-final-source rerun is in progress. Focused crypto/game/poll suite: 47 PASS; the mechanics matrix covers 4,400 dealing cases and 360 simulated turns. Locked-ready editing and canonical/exact UUID regressions were corrected. Full candidate native-browser/hosted gates remain separately pending.

Production uses Vercel Functions with request-local PostgresStore. SQL stores room JSON, presence, durable quota rows and private photo bytes. Atomic room version covers game changes and heartbeats; game revision changes only for reducer commits. Matching revisions use a SQL compact read; authentication and absence detection remain server-side, and only complete state may enter autoPause/CAS. Initial/changed state and photo-proof revalidation fetch full state.

The synthetic 12-player/240-card budget measured 4,361 bytes per compact SQL row and 893 bytes per unchanged HTTP response; full changed state and photos remain larger. Provisioned free allowances are finite: 1 GB storage, 100 CU-hours compute and 5 GB egress. This is not unlimited public capacity. Preserve 24-hour room expiry, daily cleanup and existing limits; do not silently lower game limits or authorize costs.

## Preserve and finish

Keep the same repository Raminyazdani/-bist-soali-dorehamI and Vercel project rooye-pishooni / prj_5ZbepebkVmFbJdiLzdiWlsArSypK, scope ramin-yazdanis-projects, fra1. DATABASE_URL is server-only; Production CRON_SECRET protects 04:00 UTC cleanup. Initialize idempotent schema with scripts/init-postgres.mjs using an explicitly supplied ignored env file. Never commit credentials, photos/session data or signed links; retain .vercelignore and inspect CLI dry-runs.

Record the exact candidate source, run full unit/build/native suites, then actual Neon Preview game/photo/privacy/lobby/creator-away and cleanup checks. Merge/deploy only the tested head; verify complete stable-URL flows before declaring activation. Mobile browser contexts are not physical-phone tests. Honor Retry-After and do not weaken assertions or quotas.

Game rules remain those in README: 2–12 players, 1–20 cards each, unbiased balanced dealing without own/duplicate cards, mandatory text/optional photos, 20 questions, confirmations, pause/undo/reconnect/management, score/time ranking and replay. Photos remain private bytea, checked through expiring per-player generation proofs and current card visibility. No authoritative process-memory, phone or production disk fallback.

The original Vercel Blob store is untouched and suspended. Its data/old lobbies are not claimed migrated; create fresh rooms after the free release. Earlier PeerJS lobbies also remain historical. See VERIFICATION.md for separate historical Blob evidence and current candidate gates; docs/LOCAL_CONTINUATION.md is the current execution brief.
