# Release blocked by Vercel Blob quota — 2026-10-12 (Europe/Berlin)

The tested server-backed version is merged and deployed, but the public game is currently unavailable. Vercel suspended the connected private Blob store after a usage quota was exceeded. Production cannot create its first lobby. Public release verification is incomplete; READY/build status does not establish a playable game.

Repository: https://github.com/Raminyazdani/-bist-soali-dorehamI
Merged PR: https://github.com/Raminyazdani/-bist-soali-dorehamI/pull/1
Stable URL, currently blocked: https://rooye-pishooni.vercel.app/
Tested runtime: `5ff76753c0ef46985fc41ed18fb872e8cb87fdeb`.
Merge/master: `d8133895783c8cbbfa24316b852e303056cd6166`, merged at 20:44:59 Europe/Berlin.
Production: `dpl_DHsLuks9GoRY4qpaDjkjgRxAxb2B`, READY, Git-source master; runtime matches the tested head.
Master CI: [run 38293010587](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/38293010587), PASS.

Native Windows: 45 unit/HTTP/storage tests and build passed; four suites passed with 12/7/4/5 checks and zero browser errors. Actual Preview: four suites passed with 12/6/4/4 checks plus six privacy boundaries, zero backend/browser errors, completed at 20:36:55. Stable Production: first lobby creation returned HTTP 503; remaining suites stopped. The authenticated cron trigger also returned 503. See VERIFICATION.md for exact provenance and failed attempts. Tests used mobile Chromium contexts, not physical phones.

## Proven blocker and return date

Authenticated store-management API v1 reports private `rooye-pishooni-private` / `store_aI18UxfGKbZ3F7x1`, fra1:

- `status: limits-exceeded-suspended`
- `billingState: suspended`
- `usageQuotaExceeded: true`
- `isTokenExpired: false`
- Correct connection to this project's Preview and Production environments.
- `updatedAt: 1791830328879`, equivalent to 2026-10-12 20:38:48.879 Europe/Berlin, after successful Preview completion.

Actual SDK GET returns HTTP 403, `Your store is blocked`. Read-only dashboard inspection states that access resumes on **2026-11-11**. These are direct provider observations, superseding the initial Production authentication/binding hypothesis.

The dashboard shows this store's usage as 3.2k/10k Simple Operations, 1.5k/2k Advanced Operations, 24.2 MB/10 GB transfer and 133 kB average/1 GB storage. These per-store counters are below the displayed allowances; neither they nor the suspension metadata establish which team/account usage category exhausted its quota. Do not claim a particular category caused suspension.

Vercel's documented Hobby allowances include 2,000 Advanced Operations and 10,000 Simple Operations. The policy disables Blob access when included usage is exceeded and describes a 30-day wait. The specific 2026-11-11 return date above comes from the authenticated dashboard. [Vercel Blob usage and pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing).

The account remains Hobby. No paid upgrade, trial, payment or new terms were accepted. No replacement store, reset/deletion or key rotation was performed. Do not retry blocked game/cron requests, delete data, rotate working keys or create stores to bypass the quota. A user decision is required about waiting for provider access to return or explicitly authorizing a different hosting/cost approach. After access is restored, verify provider state and rerun all four stable-URL suites, privacy boundaries and authenticated cleanup before claiming completion.

## Preserved project and implementation

Project: `rooye-pishooni` / `prj_5ZbepebkVmFbJdiLzdiWlsArSypK`. Team: `ramin-yazdanis-projects` / `team_t1y5QDuakPdppOy5zuZLx66A`. Region fra1; existing Git integration uses master. Private Blob is attached to Preview/Production. Production CRON_SECRET is configured for daily cleanup at 04:00 UTC; successful authenticated cleanup and a successful scheduled daily run remain unverified.

Vercel Functions/private Blob are the authoritative room/photo backend. Each browser connects independently over HTTP; the creator's open page is unnecessary. State reads bypass cache; writes retain atomic ETag conditions. Mutable JSON reads request identity encoding to retain the strong version from the same body response. The exact genuine SDK conditional-operation conflict enters the existing bounded fresh-state/CAS retry; unrelated storage errors still propagate. Photos remain private. No authoritative process memory, phone storage or production disk fallback exists.

Preserved rules: 2–12 players; 1–20 cards each; required text/optional photos; no own/duplicate cards; balanced authors; immediate question/undo; confirmation for results/destructive controls; countdown/pause excluded from time; 20-question limit; points descending then total duration of every completed turn ascending, with exact ties sharing rank. Replay retains the group and clears cards/scores. Room lifetime is 24 hours.

Earlier releases used creator-hosted PeerJS/WebRTC. Their evidence is historical; v3 sessions start fresh server-backed rooms and peer-hosted lobbies are not migrated. Preserve this repository/history, project, store and credentials. Resume using docs/LOCAL_CONTINUATION.md and AGENTS.md.
