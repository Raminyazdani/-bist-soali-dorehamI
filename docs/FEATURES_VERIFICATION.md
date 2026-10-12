# Configurable rules, drafts and URL photos — verification draft

Date: 2026-10-12, Europe/Berlin. The same free Neon app/repository/project is continued under the latest human request; no paid service, trial or rebuild. Current public baseline remains the previously verified free release in VERIFICATION.md. This new feature candidate is implemented but its complete native, Preview and Production release gates are pending. Exact candidate commit/deployment identifiers will be recorded after the source checkpoint; no future hash or success is assumed.

## Implemented contracts

- New room settings: questions20, autoPausefalse, sharedControlstrue; questions allow10/20/30. Legacy rooms retain20/true/false. Host-only lobby setSettings also accepts cardsPerPlayer, clears readiness and is locked after card creation starts.
- Shared controls allow authenticated members to start an all-ready group, advance completed turns and replay only after game completion. Existing mid-game reset/kick/close protections stay in place. Current referee or host can delegate; a non-guesser may claim after confirmed referee absence strictly over20s, independent of management. The20s referee flag is refreshed in full and compact responses.
- Pending text is scoped by room/player/generation and restored only while writing/unready. Matching edit tickets and protected in-flight cards prevent older responses/polls from erasing newer text, including A(server)→B(inflight)→A(local). Ready waits for drain. Lifecycle keepalive, visible resume and connection retry preserve text. No photo, proof, URL or token enters the new draft cache; server state remains authoritative.
- POST /api/image-import authenticates membership/card ownership/unready writing before and after fetch. Direct HTTPS/public destinations only; every DNS result/redirect is checked and the connection uses a validated IP with TLS hostname checks.10s server timeout, at most3 redirects, effective3MiB API response cap and20 imports/10min/player. Valid raster bytes return to the existing client compression/upload path, retaining the600KiB private-upload limit. No hotlinked image or retained external URL replaces private photo storage.
- VITE_APP_VERSION and no-store /version.json support a60s visible check plus resume. An8s client timeout prevents stalled checks; matching version clears stale update notice. Refresh is explicit and blocked during a turn, uploads, pending text or unsaved lobby settings. Busy/job transitions immediately refresh its eligibility without repeatedly replacing the button.

## Evidence so far — local/implementation scope

| Check | Observed result |
| --- | --- |
| Full unit suite |116 total,115 PASS,1 intentional live-provider skip,0 failures |
| Server focused settings/away/privacy contracts |65 PASS |
| Image-import SSRF/redirect/DNS/type/size/timeout unit cases |14 PASS |
| Pending-text unit regressions |6 PASS; A→B→A regression was red before the fix and green after |
| Image-import HTTP auth/ownership/limits/revalidation cases |3 PASS |
| Actual public gstatic raster fetch |30,320 bytes received; this is a real fetch check, not a full deployed-game result |
| Frontend syntax/build/whitespace |PASS after the version-button eligibility fix |
| Working-tree features E2E, completed 22:24:29 Berlin |7 checks,3 players,3 turns PASS;0 browser errors. Actual private URL photo, offline API text/reload recovery, guest referee claim,9-point score with10 questions, shared replay and identity-preserving manual version refresh |
| Deployment package/source audits |63 package paths,0 private paths;62 source paths,0 forbidden paths or provider secrets |
| Exact-source complete native browser/photo/lobby/background/features |Pending final run/provenance |
| Actual candidate Preview suites, privacy, import/version checks |Pending |
| Exact tested-head merge and stable Production verification |Pending |

An earlier local features run completed six core checks but failed the final refresh-button check: the button stayed disabled after busy ended. The small fix refreshes notice eligibility on busy/draft transitions and preserves its DOM node when eligibility is unchanged. The strict30s assertion was not relaxed; the working-tree rerun passed all7 checks at22:24:29 Berlin. Earlier test-only readiness/revision and lazy-thumbnail waits were corrected separately; the pending-text reversal and lobby-settings races have red/green regression evidence. Exact candidate full five-suite native and hosted runs remain pending. The older free-release native/Preview/Production passes do not prove this feature candidate.

Tests use isolated mobile Chromium contexts, not physical phones. Exact-source final evidence must distinguish local disk-server restart from hosted creator absence. Quotas/assertions remain enabled. Credentials, room/session identifiers, private photos/proofs, screenshots and raw logs remain ignored and excluded from deployment uploads.

## Implementation basis

The importer design checks resolved destinations and binds network connections to validated addresses, retaining hostname/TLS verification; redirects are handled under the same policy. These design choices follow the destination-validation/rebinding guidance in [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). This link is design context, not a security certification or test result.

The public importer lowers its response cap to3MiB, below the platform's4.5MB Function request/response limit. [Vercel Functions Limits](https://vercel.com/docs/functions/limitations). The final private upload remains capped at600KiB. All application-specific check counts above come from local execution/implementation evidence, not those web sources.

After full final gates pass, record exact source, CI, deployment, each suite/count/time, live provider/privacy/import/version/cleanup results and safe runtime-log totals; only then replace pending wording and declare the feature release public. Free1GB/100CU-hours/5GB egress capacity remains finite; no unlimited-use claim.
