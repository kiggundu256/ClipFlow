# Staging deployment

This guide prepares ClipFlow for a real staging environment. The container image can run the Next.js web app and publishing worker as separate services where shared media storage is available. For providers whose persistent volumes attach to only one service (including Railway), use the single-service staging mode below until media is moved to shared object storage.

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

## Railway staging layout with the current local media storage

Railway volumes attach to one service, not simultaneously to separate web and worker services. To keep the current filesystem-based media library available to both processes for the first staging upload, use one Railway service with the included supervisor script and one persistent volume mounted at `/data/media`. Set the service start command to `bash scripts/start-staging.sh`. This runs the web app and, when enabled, the publishing worker in the same container. It is appropriate for a controlled first upload only; keep a single replica. For production scaling, move media to shared object storage before splitting the worker into its own service.

Railway mounts volumes as root. With the current non-root Docker image, set `RAILWAY_RUN_UID=0` on that staging service so the app can write to the mounted volume; do not expose the container or its shell to untrusted users.

For the first connection, leave `RUN_PUBLISHING_WORKER=false` and `CLIPFLOW_PUBLISHING_ENABLED=false`. After the channel and media are verified, set both to `true` only for the controlled unlisted upload.

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
| `RUN_PUBLISHING_WORKER` | `false` initially; set `true` only for the supervised single-service staging test |

The web and worker processes must use the same database, Redis, encryption key, and media storage. If they are separate services, the media storage must be shared or object-based. Do not rotate `TOKEN_ENCRYPTION_KEY` after accounts are connected unless you have a deliberate token re-encryption plan; existing encrypted tokens become unreadable with a different key.

## Google OAuth callback

After the staging HTTPS domain is assigned, register this exact URI in the Google Cloud OAuth web client:

`https://YOUR-STAGING-DOMAIN/api/oauth/google/callback`

Set `NEXT_PUBLIC_APP_URL` to the same origin. The callback URI must match exactly, including scheme, host and path. Enable YouTube Data API v3 in the same Google Cloud project. If the OAuth audience is External and the app remains in Testing mode, add the Google account used for the test to the test-user list. Google issues refresh tokens that expire after 7 days for External apps in Testing mode when requesting YouTube scopes, so this is suitable only for a short staging test; reconnect when required. For longer-running staging or public customers, review the OAuth publishing status and any scope-verification requirements in Google Cloud before launch.

ClipFlow requests `youtube.readonly` and `youtube.upload`. The connected account must grant the upload scope. Use a channel you control and a short, non-sensitive test video.

## Safe first-upload sequence

1. Deploy the web service (or the combined Railway staging service), PostgreSQL and Redis with publishing disabled.
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
