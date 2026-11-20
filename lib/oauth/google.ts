import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_CHANNELS_URL = "https://youtube.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true";
const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.upload"];

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function encryptionKey() {
  const key = Buffer.from(requiredEnv("TOKEN_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptToken(value: string) {
  const [iv, tag, encrypted] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) throw new Error("Stored token has an invalid encrypted format.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function hashState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export async function createGoogleAuthorizationUrl(userId: string, workspaceId: string) {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const appUrl = requiredEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  const state = randomBytes(32).toString("base64url");

  await prisma.oAuthState.create({
    data: {
      stateHash: hashState(state),
      provider: "YOUTUBE",
      userId,
      workspaceId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });

  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/oauth/google/callback`,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state
  }).toString();

  return url.toString();
}

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

type GoogleChannelResponse = {
  items?: Array<{ id: string; snippet?: { title?: string; customUrl?: string } }>;
};

export async function completeGoogleAuthorization(code: string, state: string) {
  const stateHash = hashState(state);
  const pending = await prisma.oAuthState.findUnique({ where: { stateHash } });
  const now = new Date();
  if (!pending || pending.provider !== "YOUTUBE" || pending.expiresAt <= now) {
    if (pending && pending.expiresAt <= now) {
      await prisma.oAuthState.deleteMany({ where: { id: pending.id } });
    }
    throw new Error("This connection request has expired. Please try again.");
  }

  // Atomically consume the state so concurrent callbacks cannot both succeed.
  const consumed = await prisma.oAuthState.deleteMany({
    where: { id: pending.id, provider: "YOUTUBE", expiresAt: { gt: now } }
  });
  if (consumed.count !== 1) {
    throw new Error("This connection request has already been used or has expired. Please try again.");
  }

  const appUrl = requiredEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: `${appUrl}/api/oauth/google/callback`,
      grant_type: "authorization_code"
    }),
    cache: "no-store"
  });

  if (!tokenResponse.ok) throw new Error("Google could not complete the authorization. Please reconnect your YouTube channel.");
  const tokens = await tokenResponse.json() as GoogleTokenResponse;

  const channelResponse = await fetch(YOUTUBE_CHANNELS_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store"
  });
  if (!channelResponse.ok) throw new Error("We could not read your YouTube channel details.");
  const channelData = await channelResponse.json() as GoogleChannelResponse;
  const channel = channelData.items?.[0];
  if (!channel?.id) throw new Error("No YouTube channel was found on this Google account.");

  const existing = await prisma.socialAccount.findUnique({
    where: {
      workspaceId_platform_platformAccountId: {
        workspaceId: pending.workspaceId,
        platform: "YOUTUBE",
        platformAccountId: channel.id
      }
    }
  });

  const refreshToken = tokens.refresh_token
    ? encryptToken(tokens.refresh_token)
    : existing?.encryptedRefreshToken ?? null;

  await prisma.socialAccount.upsert({
    where: {
      workspaceId_platform_platformAccountId: {
        workspaceId: pending.workspaceId,
        platform: "YOUTUBE",
        platformAccountId: channel.id
      }
    },
    create: {
      workspaceId: pending.workspaceId,
      platform: "YOUTUBE",
      platformAccountId: channel.id,
      username: channel.snippet?.customUrl ?? null,
      displayName: channel.snippet?.title ?? "YouTube channel",
      encryptedAccessToken: encryptToken(tokens.access_token),
      encryptedRefreshToken: refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: tokens.scope?.split(" ") ?? GOOGLE_SCOPES
    },
    update: {
      username: channel.snippet?.customUrl ?? null,
      displayName: channel.snippet?.title ?? "YouTube channel",
      encryptedAccessToken: encryptToken(tokens.access_token),
      encryptedRefreshToken: refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: tokens.scope?.split(" ") ?? GOOGLE_SCOPES
    }
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: pending.workspaceId,
      actorUserId: pending.userId,
      action: "social_account.connected",
      targetType: "SocialAccount",
      targetId: channel.id,
      metadata: { platform: "YOUTUBE" }
    }
  });

  return pending.workspaceId;
}
