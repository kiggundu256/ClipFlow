# ClipFlow

ClipFlow is a multi-tenant social publishing workspace for creators and agencies. The first milestone establishes the web application, local development services, database schema, and CI checks.

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

Enable the YouTube Data API v3 in the Google Cloud project. The initial integration requests YouTube read access and upload permission. Do not commit real credentials or encryption keys.
