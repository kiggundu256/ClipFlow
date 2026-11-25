import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { consumeOAuthState, createOAuthState } from "@/lib/oauth/state";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YOUTUBE_CHANNELS_URL = "https://youtube.googleapis.com/youtube/v3/channels";
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
  const parts = value.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error("Stored token has an invalid encrypted format.");
  }
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, "base64url"));
  if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) {
    throw new Error("Stored token has an invalid encrypted format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function createGoogleAuthorizationUrl(userId: string, workspaceId: string) {
  const clientId = requiredEnv("GOOGLE_CLIENT_ID");
  const appUrl = requiredEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  const state = await createOAuthState(userId, workspaceId, "YOUTUBE");

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
  nextPageToken?: string;
};

async function getGoogleChannels(accessToken: string) {
  const channels: NonNullable<GoogleChannelResponse["items"]> = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(YOUTUBE_CHANNELS_URL);
    url.searchParams.set("part", "id,snippet");
    url.searchParams.set("mine", "true");
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    if (!response.ok) throw new Error("We could not read your YouTube channel details.");

    const data = await response.json() as GoogleChannelResponse;
    channels.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return channels;
}

export async function completeGoogleAuthorization(code: string, state: string) {
  const pending = await consumeOAuthState(state, "YOUTUBE");

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
  const channels = await getGoogleChannels(tokens.access_token);
  if (channels.length === 0) throw new Error("No YouTube channel was found on this Google account.");

  for (const channel of channels) {
    if (!channel.id) continue;

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
  }

  return pending.workspaceId;
}

/**
 * Returns a usable YouTube access token and refreshes it shortly before expiry.
 * Call this from server-side YouTube API adapters, never from client code.
 */
export async function getValidGoogleAccessToken(socialAccountId: string) {
  const account = await prisma.socialAccount.findUnique({ where: { id: socialAccountId } });
  if (!account || account.platform !== "YOUTUBE" || !account.encryptedAccessToken) {
    throw new Error("The YouTube channel is not connected. Please reconnect it.");
  }

  const refreshBefore = Date.now() + 60_000;
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() > refreshBefore) {
    return decryptToken(account.encryptedAccessToken);
  }

  if (!account.encryptedRefreshToken) {
    throw new Error("The YouTube connection has expired. Please reconnect the channel.");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: decryptToken(account.encryptedRefreshToken),
      grant_type: "refresh_token"
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Google could not refresh this YouTube connection. Please reconnect the channel.");
  }

  const tokens = await response.json() as GoogleTokenResponse;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const encryptedAccessToken = encryptToken(tokens.access_token);

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      encryptedAccessToken,
      tokenExpiresAt: expiresAt,
      ...(tokens.scope ? { scopes: tokens.scope.split(" ") } : {})
    }
  });

  return tokens.access_token;
}
