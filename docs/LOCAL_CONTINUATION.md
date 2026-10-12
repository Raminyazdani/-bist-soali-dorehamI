# Released free alternative — 2026-10-12 (Europe/Berlin)

This same game is publicly playable at https://rooye-pishooni.vercel.app/. The latest human request authorized immediate free activation/mechanics audit, and Neon terms were accepted directly. Full native, actual Preview and stable Production suites passed; no sign-in/terms/payment approval is pending. No payment, paid trial, upgrade or card requirement was introduced. Historical Blob-only/backend-freeze/wait instructions are superseded.

Repository:https://github.com/Raminyazdani/-bist-soali-dorehamI.git (leading hyphen, final capital I).
Release PR:https://github.com/Raminyazdani/-bist-soali-dorehamI/pull/2, merged21:41:36.
Tested runtime:50f60243e6eaeb9127440141dc42b249915a2074.
Merge/master:bf886026e0cf14e4cfb9cc6fe1babd4bd9bbd06a.
Stable:dpl_7vZEwopPXvCCnQw3QCNiiuU3GBwM, READY, same runtime.
Native complete21:37:14; Preview21:39:39; Production21:48:48. Exact tables/CI/cleanup are in VERIFICATION.md. Later documentation commits preserve the tested runtime.

Keep the existing rooye-pishooni project/prj_5ZbepebkVmFbJdiLzdiWlsArSypK, scope ramin-yazdanis-projects, fra1, Node24/Vite/npm run build/dist. NeonFree resource store_Sd3kFMmUOKStEBvc/square-sound-46294634 is active/available,free_v3,costFree,paymentMethodRequired=false,quota not exceeded. Preview/Production only share the database; Vercel remains Hobby. Old Blob store/data remain untouched/suspended and were not migrated. Players refresh/start fresh rooms.

## Preserve implementation and checks

Request-local SQL persists rooms/presence/quotas/private bytea photos. Opaque body/presence version provides atomic CAS; game revision tracks reducers. Compact unchanged polls authenticate and check disconnects; reducers/CAS and photo-proof renewal require full state. Preserve server time, crypto unbiased integer draws/Fisher–Yates, canonical/exact IDs, locked-ready protection, privacy/session proofs and all README mechanics. No production memory/phone/disk fallback. Expiry stays24 hours.

Units77 total/76 PASS/1 explicit hosted skip; buildPASS. Separate live Neon43 checksPASS/0 owned fixtures; focused game/crypto/poll47PASS/4,400 dealing cases/360 turns. Native12/7/4/5 and hosted Preview/Production12/6/4/4+privacy6 all passed with0browser errors; hosted logs0diagnostics. These are mobile browser contexts, not physical phones. Local server restart is not a hosted assertion.

DATABASE_URL is the only database authentication credential and stays server-only; CRON_SECRET protects04:00UTC daily cleanup. Schema initialization is idempotent: node scripts/init-postgres.mjs with an explicit ignored env filename. Manual platform cleanup200 and unauthorized401 are verified; no overnight scheduled invocation is claimed. Never publish secrets or infer an empty runtime key from intentionally blank sensitive env export.

Local prerequisites:Git,Node24,npm,gh,VercelCLI,Playwright Chromium. Run npm ci; npm test; npm run build; node test/browser-e2e.mjs; node test/photo-e2e.mjs; node test/lobby-e2e.mjs; node test/background-e2e.mjs. Local E2E uses durable disk; explicit live-provider tests use only owned fixtures. Hosted E2E_URL is process-scoped; remove it for local tests. Honor Retry-After and existing limits; never weaken assertions or broadly delete user data.

Free1GB storage/100CU-hours/5GB egress/month capacity is finite. Synthetic compactSQLrow/unchangedHTTP4,361/893bytes reduces polling traffic; changed state/photos remain larger. Do not authorize costs or silently lower game limits. Future relevant edits require complete affected native/live/hosted checks, exact provenance and stable-URL verification.

Preserve newer remote/user commits and use ordinary Git/expected-head leases; no force reset/push, recreated repository or unrelated project. Recheck actual service identity before mutations. Historical cloud paths/processes/pairing values are not portable credentials. Keep .vercelignore, inspect CLI dry-runs and exclude .env/.vercel auth, test screenshots/rooms/photos/session links from Git/uploads.
