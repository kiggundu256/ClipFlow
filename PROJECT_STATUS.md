# ClipFlow Project Status

Last updated: 2026-11-21

This file is the persistent build checkpoint. Keep it updated as milestones are completed.

## Product direction

ClipFlow is a public, multi-tenant SaaS for creators and small teams to manage media, connect social channels, plan content, schedule publishing, and eventually subscribe to paid plans. The initial target pricing discussed is approximately $5–$10/month. The repository is the source of truth: https://github.com/kiggundu256/ClipFlow.

Build priorities:
- Working product flows before cosmetic polish.
- Official platform APIs and permission-compliant publishing.
- Secure workspace isolation and encrypted provider tokens.
- Prefer low-cost infrastructure and self-hosting where practical.
- Never claim TikTok public auto-publishing is available until the required platform approval is actually granted.

## Milestone tracker

### 1. Identity and workspace foundation — MERGED

- [x] Database-backed user registration and login.
- [x] Password hashing and persistent secure sessions.
- [x] First workspace, owner membership, and free subscription created transactionally.
- [x] Workspace-scoped dashboard counts.
- [x] PostgreSQL migrations and CI validation.
- Merged PR: https://github.com/kiggundu256/ClipFlow/pull/1
- Merge commit: `b36a126794b79ac222ec3ad8ae39b10b610ca48b`

### 2. Social account connections — IN PROGRESS

- [x] Persisted expiring, single-use OAuth state linked to user and workspace.
- [x] Google OAuth authorization and callback for YouTube.
- [x] Discover and connect every YouTube channel returned for the authorized Google account, including paginated results.
- [x] Workspace-scoped social account upserts and audit events.
- [x] AES-256-GCM token encryption using a deployment-managed 32-byte key.
- [x] Server-side access-token refresh before expiry, with reconnect errors when refresh is revoked.
- [x] Channel center and connected-account display.
- [x] Hardened OAuth state consumption with an atomic single-use database delete to prevent concurrent callback replay.
- [x] Verify CI for YouTube and Instagram OAuth integration (run #24, success: Prisma validation, migration deploy, typecheck, lint, and production build).
- [ ] Configure Google Cloud OAuth client and YouTube Data API v3.
- [ ] Test a real YouTube channel connection in local/staging.
- [ ] Configure Meta app and test a real Instagram Professional account connection.
- [x] Implement Meta Instagram Login OAuth for eligible Instagram professional accounts.
- [ ] Implement TikTok Login Kit and Content Posting API after required permissions are confirmed.
- Current PR: https://github.com/kiggundu256/ClipFlow/pull/2
- Working branch: `feature/social-oauth-foundation`

Required server environment variables for YouTube and Instagram:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `META_APP_ID` and `META_APP_SECRET` (Instagram Login)
- `TOKEN_ENCRYPTION_KEY` (base64-encoded 32-byte key)
- `CLIPFLOW_MEDIA_DIR` (persistent private media directory)
- `NEXT_PUBLIC_APP_URL`

Google OAuth callback:
- Local: `http://localhost:3000/api/oauth/google/callback`
- Production: `https://YOUR_DOMAIN/api/oauth/google/callback`

### 3. Content management — IN PROGRESS

- [x] Private workspace-scoped media upload for MP4, MOV, WebM, JPEG, PNG and WebP (100 MB cap; file-signature validation).
- [x] Private media library and authenticated media delivery route.
- [x] Draft editor with captions and hashtags.
- [x] Multi-channel draft targeting through a normalized PostTarget relation.
- [ ] Platform-specific preview and validation against publishing constraints.
- [ ] Move media storage to a production object-storage adapter before horizontal scaling.

### 4. Calendar and publishing engine — NOT STARTED

- [ ] Calendar and scheduling workflow.
- [ ] Redis-backed background jobs and reliable retries.
- [ ] Platform-specific publishing adapters.
- [ ] Publishing history, failure states, and notifications.
- [ ] Respect platform rate limits, account eligibility, and review requirements.

### 5. SaaS plans and billing — NOT STARTED

- [ ] Usage limits and metering.
- [ ] Subscription checkout and billing portal.
- [ ] Webhook-driven subscription state.
- [ ] Free and paid plan entitlements.

### 6. Production launch — NOT STARTED

- [ ] VPS deployment and domain.
- [ ] HTTPS, environment secrets, backups, and monitoring.
- [ ] Production smoke tests and security review.
- [ ] Public onboarding and launch.

## Working agreement

Work one milestone at a time. Keep changes on feature branches, open pull requests, run CI, fix failures, and merge only after verification. Update this status file at each meaningful checkpoint. Avoid asking the user to perform local setup steps when the task can be completed directly through the repository and GitHub automation.
