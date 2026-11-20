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

## YouTube OAuth setup

Create a Google OAuth 2.0 Web application client and register this exact redirect URI:
`http://localhost:3000/api/oauth/google/callback` for local development, plus your production callback URL after deployment.

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `TOKEN_ENCRYPTION_KEY` in your local environment and deployment secret store. Generate the encryption key with:

```bash
openssl rand -base64 32
```

Enable the YouTube Data API v3 in the Google Cloud project. The integration requests YouTube read access and upload permission. Do not commit real credentials or encryption keys.

## Instagram Login setup

Create a Meta app and add the Instagram product with Instagram Login. Register this exact redirect URI in the app's Instagram Login settings:
`http://localhost:3000/api/oauth/instagram/callback` for local development, plus your production callback URL after deployment.

Set `META_APP_ID` and `META_APP_SECRET` in the server environment. ClipFlow requests `instagram_business_basic` and `instagram_business_content_publish`, and supports Instagram Business and Creator accounts. A Facebook Page is not required for this Instagram Login flow. Before connecting accounts belonging to other people in production, complete Meta's required app review and access verification for the requested permissions.

Instagram access tokens are exchanged for long-lived tokens and refreshed server-side before expiry. The shared `TOKEN_ENCRYPTION_KEY` protects stored tokens.
