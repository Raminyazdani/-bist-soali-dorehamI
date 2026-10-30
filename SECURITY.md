# Security and private data

Keep credentials, runtime environment files, database snapshots, user records,
exports, backups, cookies, private keys, photos and session/token proofs outside
Git, including private repositories. Use synthetic fixtures for tests and reports.
The ignore rules are an extra boundary; they do not remove already tracked files.
Review the exact staged file list and all intended history before publication.

Do not put credentials in issues, logs, screenshots or commit messages. If a real
credential is exposed, stop publication and revoke/rotate it through its provider.
Report security concerns privately to the repository owner without attaching
private data or usable credentials. This repository does not authorize messaging,
provider changes, paid resources, production migrations or database resets.

Local dependency installation should use `npm ci --ignore-scripts --no-audit`.
Run `npm audit --json` separately and inspect findings. A passing local test or
static scan does not establish hosted security, provider configuration, complete
PII detection, or permission to publish third-party material.

## Game runtime boundary

`DATABASE_URL`, `CRON_SECRET`, Blob credentials and OIDC tokens are server-only.
Never use a client-visible `VITE_` prefix for them. Game rooms, player photos,
sessions and proofs remain private runtime data. Unit tests use injected/local
storage and mocks. Leave `POSTGRES_LIVE_TESTS` unset and do not supply live
credentials for routine local tests. Live-provider and hosted acceptance checks
need separate explicit authorization and disposable provider fixtures.
