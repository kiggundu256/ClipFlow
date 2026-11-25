# ClipFlow

ClipFlow is a multi-tenant social publishing workspace for creators and agencies. It connects official social APIs to a shared content and publishing workflow.

## Current status

This repository is the source of truth. TikTok public Direct Post is not enabled by this scaffold: public posting requires TikTok app audit approval. Integrations must use official platform APIs and respect their review, publishing, and account limits.

## Requirements

- Node.js 20.9 or newer (LTS recommended)
- Docker Desktop with WSL 2 on Windows
- Git

## Local development

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and Redis: `docker compose up -d`.
3. Install packages: `npm install`.
4. Generate Prisma Client: `npx prisma generate`.
5. Apply migrations: `npx prisma migrate dev --name init`.
6. Start the app: `npm run dev`.
7. Open http://localhost:3000.

## Safety

Never commit `.env`, platform access tokens, database passwords, or production secrets. Use GitHub Actions secrets and your deployment provider's secret store.

## Staging deployment\n\nSee [docs/staging-deployment.md](docs/staging-deployment.md) for the container build, separate web/worker services, persistent storage, environment variables, Google callback setup and safe first-upload checklist.\n\n## YouTube OAuth setup

Create a Google OAuth 2.0 Web application client and register this exact redirect URI:
`http://localhost:3000/api/oauth/google/callback` for local development, plus your production callback URL after deployment.

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `TOKEN_ENCRYPTION_KEY` in your local environment and deployment secret store. Generate the encryption key with:

```bash
openssl rand -base64 32
```

Enable the YouTube Data API v3 in the Google Cloud project. The integration requests YouTube read access and `https://www.googleapis.com/auth/youtube.upload`. Existing connected channels must have this upload scope; disconnect and reconnect if ClipFlow reports missing upload permission. Do not commit real credentials or encryption keys.

## Instagram Login setup

Create a Meta app and add the Instagram product with Instagram Login. Register this exact redirect URI in the app's Instagram Login settings:
`http://localhost:3000/api/oauth/instagram/callback` for local development, plus your production callback URL after deployment.

Set `META_APP_ID` and `META_APP_SECRET` in the server environment. ClipFlow requests `instagram_business_basic` and `instagram_business_content_publish`, and supports Instagram Business and Creator accounts. A Facebook Page is not required for this Instagram Login flow. Before connecting accounts belonging to other people in production, complete Meta's required app review and access verification for the requested permissions.

Instagram access tokens are exchanged for long-lived tokens and refreshed server-side before expiry. The shared `TOKEN_ENCRYPTION_KEY` protects stored tokens.

## Content and media storage

The content editor saves workspace-scoped drafts and supports selecting multiple connected channels. The media library currently stores uploads on the application server in a private directory (default: `./private-media`). Set `CLIPFLOW_MEDIA_DIR` to a persistent absolute path in production, keep that directory outside the public web root, restrict filesystem permissions, and include it in encrypted backups. The first upload release accepts MP4, MOV, WebM, JPEG, PNG and WebP files up to 100 MB. Object storage and resumable large uploads are follow-on infrastructure work; do not run multiple app instances with local media storage unless they share a persistent volume.

## Background publishing engine

The publishing foundation uses BullMQ with Redis and PostgreSQL. The standalone worker scans scheduled posts every 15 seconds, atomically moves due posts into the queue, and creates one durable queue job per destination account. Queue job IDs are deterministic so a worker restart between the database update and queue insertion can be recovered on the next scan. Each destination has its own status and publishing-attempt history; transient provider errors use exponential retry.

Start Redis with `docker compose up -d redis`. Configure `REDIS_URL` for both the web app and worker. The worker command is `npm run worker:publish` (the script runs with Node's React Server condition so server-only modules remain unavailable to browser bundles). Run it as a separate supervised process (for example, a systemd service or a dedicated container) alongside the Next.js web process. Redis persistence is enabled in the included Compose configuration.

### YouTube publishing adapter

The YouTube adapter uploads video files through the official YouTube Data API v3 resumable-upload protocol. It uses bounded 8 MiB chunks, checks upload progress after interrupted requests, and records the returned YouTube video ID against the destination. It publishes videos only (not image posts). The title is derived from the first caption line, the full caption becomes the description, hashtags are converted into tags, and the default category is People & Blogs (22).

Set `YOUTUBE_DEFAULT_PRIVACY_STATUS` to `private`, `unlisted`, or `public`; it defaults to `unlisted` for safe first tests. `YOUTUBE_CATEGORY_ID` defaults to `22`. Per-post privacy controls and YouTube processing-status polling are follow-on work. A successful API upload means YouTube returned a video ID; it does not guarantee processing has finished or that the video is already publicly viewable.

The worker must remain disabled until Google OAuth credentials, YouTube Data API v3, Redis, PostgreSQL, persistent media storage, and the YouTube upload scope are configured. Start with an unlisted test video and confirm it appears in the connected channel before enabling scheduled publishing in production. If an upload's final outcome cannot be confirmed, ClipFlow stops automatic retries and marks it for manual channel reconciliation rather than risking duplicate uploads.

Instagram and TikTok adapters are not registered yet.
