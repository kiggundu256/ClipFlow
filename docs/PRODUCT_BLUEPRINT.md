# ClipFlow product blueprint

## Product direction
ClipFlow is a public, multi-tenant social content planning and publishing SaaS for independent creators and agencies. Users register, create workspaces, invite collaborators, connect their own social channels, organise media, prepare platform-specific posts, schedule content, and review publishing outcomes.

## Delivery sequence
1. Foundation: responsive web app, database, CI, secure configuration.
2. Identity and tenancy: registration, login, email verification, workspace creation, membership roles and access checks.
3. Media: secure upload flow, object storage, metadata and media library.
4. Content workflow: drafts, calendar, queue, scheduling worker, retry and audit history.
5. Platform integrations: official OAuth and publishing APIs, starting with TikTok subject to app review and approval; then Instagram and YouTube.
6. Billing: confirm a payment provider that can onboard a Uganda-based SaaS merchant and support international recurring payments before selecting plans or integrating checkout.
7. Operations: monitoring, backups, abuse controls, support tooling and production deployment.

## Platform policy guardrails
- Use official platform APIs and OAuth flows only.
- TikTok public Direct Post requires app audit approval. Do not promise public auto-publishing until approval is granted.
- An unaudited TikTok client may be restricted to private visibility. Build a useful creator product for external customers; do not use a nominal public launch to disguise an internal-only uploader.
- Display creator-specific publishing settings, previews, consent and processing status as required by platform rules.
- Verify platform-specific account caps, media requirements, scopes and review rules before enabling each integration.

## Security baseline
- Enforce workspace membership and role authorization on every tenant-scoped request.
- Encrypt provider tokens at rest using a managed secret/key strategy; never expose tokens to the browser.
- Keep secrets out of source control and logs.
- Validate uploads, MIME types, file sizes and ownership.
- Record security-sensitive actions and provider publishing attempts.
- Use verified HTTPS media URLs for providers that fetch media from a URL.

## Initial pricing hypothesis
Free, Creator ($5/month), and Pro ($10/month) are hypotheses only. Final quotas and pricing depend on storage, provider limits, support costs, payment processing and tax obligations.
