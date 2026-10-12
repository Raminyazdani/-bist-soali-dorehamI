# Free public release — 2026-10-12 (Europe/Berlin)

The same game is now playable at https://rooye-pishooni.vercel.app/ through the free Neon backend. Full native, actual Preview and stable Production suites passed. The human authorized immediate free activation/mechanics audit and directly accepted provider terms; no payment, paid trial, upgrade or card requirement was introduced. Vercel remains Hobby.

Repository: https://github.com/Raminyazdani/-bist-soali-dorehamI
Merged release PR: https://github.com/Raminyazdani/-bist-soali-dorehamI/pull/2
Verified runtime: 50f60243e6eaeb9127440141dc42b249915a2074.
Merge/master: bf886026e0cf14e4cfb9cc6fe1babd4bd9bbd06a, merged at21:41:36.
Production: dpl_7vZEwopPXvCCnQw3QCNiiuU3GBwM, READY, runtime matches tested source.
Production verification completed21:48:48; see VERIFICATION.md for exact tables.
CI: [candidate38298355943](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/38298355943) and [master38299331031](https://github.com/Raminyazdani/-bist-soali-dorehamI/actions/runs/38299331031), PASS.

Units77 total/76 PASS/1 explicit hosted skip; buildPASS. Separate actual Neon43 checksPASS with zero owned fixture leftovers. Focused game/crypto/poll47PASS,4,400 dealing cases and360 turns. Native12/7/4/5PASS; actual Preview and Production each12/6/4/4PASS plus6 privacy boundaries. Zero browser errors and zero hosted backend diagnostics. These are isolated mobile Chromium contexts, not physical phones.

The existing rooye-pishooni Vercel project/repository remain in use. Neon resource store_Sd3kFMmUOKStEBvc / square-sound-46294634 is active, available, free_v3/fra1, costFree, paymentMethodRequired=false and usageQuotaExceeded=false, verified21:46:59. It is attached only to Preview/Production, sharing the same database. DATABASE_URL and CRON_SECRET stay server-only.

Request-local PostgresStore persists room JSON, presence, durable quotas and private bytea photos. Atomic opaque version fences body/presence; game revision changes only for reducers. Compact matching-revision reads retain authentication/time/presence; autoPause/CAS and photo-proof renewal use full fresh state. No authoritative process-memory, phone or production disk fallback exists.

Rules remain those in README:2–12 players,1–20 cards each, required text/optional photos, balanced random dealing without own/duplicate cards,20 questions, confirmations, question/undo/pause, reconnect/management/creator absence, score/time ties and replay. Locked-ready editing and canonical/exact UUID regressions were fixed. Random draws use crypto rejection sampling/Fisher–Yates. Room expiry stays24 hours.

Authenticated manual platform cleanup returned200 and unauthorized cleanup401. Daily04:00UTC schedule is deployed; no overnight invocation is claimed observed. Free capacity is finite:1GB storage,100CU-hours and5GB egress/month. Synthetic compact SQL row/unchanged response sizes are4,361/893 bytes; changed state and photos remain larger. No unlimited-capacity claim.

Original Blob store/data remain untouched and suspended; old Blob/PeerJS lobbies were not migrated. Players should refresh and create fresh rooms. Historical failed boundaries remain separate in VERIFICATION.md. Resume with AGENTS.md/docs/LOCAL_CONTINUATION.md, preserving history, private data and free limits.
