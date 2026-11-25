# Staging deployment

This guide prepares ClipFlow for a real staging environment. The container image runs both the Next.js web app and the separate publishing worker; deploy them as two services from the same image.

## Required services

- Web service: Next.js app, HTTPS public URL, health check at `/api/health`.
- Worker service: separate long-running process using `npm run worker:publish`; do not expose it publicly.
- PostgreSQL 16 or compatible managed PostgreSQL with persistent backups.
- Redis 7 or compatible managed Redis with persistence enabled.
- Persistent private media volume mounted at the same absolute path in both web and worker services.
- Secret storage provided by the hosting platform.

## Build

Build the repository root with the included `Dockerfile`. The image installs dependencies, generates Prisma Client and builds Next.js. Use the same image for both services:

- Web start command: `npm run start -- -H 0.0.0.0`
- Worker start command: `npm run worker:publish`

Run `npx prisma migrate deploy` once as a release/pre-deploy command after the database is available and before the new web/worker version starts. Do not run migrations independently in both services.

## Environment variables

Set these in the hosting provider's secret/configuration store. Never commit real values.

| Variable | Required value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Staging PostgreSQL connection string |
| `REDIS_URL` | Staging Redis connection string |
| `NEXT_PUBLIC_APP_URL` | Exact public HTTPS staging origin, no trailing slash |
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID |
| `GOOGLE_CLIENT_SECRET` | Matching Google OAuth client secret |
| `TOKEN_ENCRYPTION_KEY` | Base64-encoded 32-byte random key; keep stable and back it up securely |
| `CLIPFLOW_MEDIA_DIR` | Persistent mounted directory, e.g. `/data/media` |
| `YOUTUBE_DEFAULT_PRIVACY_STATUS` | `unlisted` for first live test |
| `YOUTUBE_CATEGORY_ID` | `22` unless deliberately changed |
| `CLIPFLOW_PUBLISHING_ENABLED` | `false` until the live connection and staging checks are complete |

The web and worker services must use the same database, Redis, encryption key, and media volume. Do not rotate `TOKEN_ENCRYPTION_KEY` after accounts are connected unless you have a deliberate token re-encryption plan; existing encrypted tokens become unreadable with a different key.

## Google OAuth callback

After the staging HTTPS domain is assigned, register this exact URI in the Google Cloud OAuth web client:

`https://YOUR-STAGING-DOMAIN/api/oauth/google/callback`

Set `NEXT_PUBLIC_APP_URL` to the same origin. The callback URI must match exactly, including scheme, host and path. Enable YouTube Data API v3 in the same Google Cloud project. The OAuth consent screen must include the account used for the first test if the app is still in Testing mode.

ClipFlow requests `youtube.readonly` and `youtube.upload`. The connected account must grant the upload scope. Use a channel you control and a short, non-sensitive test video.

## Safe first-upload sequence

1. Deploy web, PostgreSQL and Redis with publishing disabled.
2. Confirm `/api/health` returns HTTP 200.
3. Create the ClipFlow owner account and sign in.
4. Connect the YouTube channel through the ClipFlow Channels page and Google consent screen.
5. Confirm the channel appears in ClipFlow and the connection includes `youtube.upload`.
6. Upload a small MP4 to the private media library and create a test post for that channel.
7. Confirm media is accessible to the worker through the shared persistent volume.
8. Enable the worker only for this controlled test by setting `CLIPFLOW_PUBLISHING_ENABLED=true` on the worker service.
9. Publish with privacy set to `unlisted`; verify the video in YouTube Studio and verify ClipFlow stores the returned video ID and successful attempt.
10. Disable the worker again until logs, retries, restart behaviour and the full staging flow have been reviewed.

Do not use a public post for the first test. Do not run multiple worker replicas until queue and concurrency behaviour have been validated.

## Operational checks before production

- HTTPS is enforced and the staging domain is stable.
- PostgreSQL backups and Redis persistence are enabled.
- Media volume is durable, private, shared by web and worker, and included in backups.
- Worker has an automatic restart policy and centralised logs.
- Database, Redis, media volume and encryption key are not shared with production.
- OAuth consent screen status and Google's testing-token expiry rules have been reviewed.
- Publishing remains disabled by default outside the controlled test window.
