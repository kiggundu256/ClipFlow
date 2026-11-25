import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { consumeOAuthState, createOAuthState } from "@/lib/oauth/state";
import { encryptToken, decryptToken } from "@/lib/oauth/google";

const AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH_URL = "https://graph.instagram.com";
const SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function createInstagramAuthorizationUrl(userId: string, workspaceId: string) {
  const appId = requiredEnv("META_APP_ID");
  const appUrl = requiredEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  const state = await createOAuthState(userId, workspaceId, "INSTAGRAM");

  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: appId,
    redirect_uri: `${appUrl}/api/oauth/instagram/callback`,
    response_type: "code",
    scope: SCOPES.join(","),
    state
  }).toString();

  return url.toString();
}

type InstagramTokenResponse = {
  access_token: string;
  user_id: string | number;
  permissions?: string[];
  token_type?: string;
  expires_in?: number;
};

type InstagramProfile = {
  user_id?: string | number;
  id?: string | number;
  username?: string;
};

async function exchangeForLongLivedToken(shortLivedToken: string) {
  const url = new URL(`${GRAPH_URL}/access_token`);
  url.search = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: requiredEnv("META_APP_SECRET"),
    access_token: shortLivedToken
  }).toString();

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Meta could not issue a long-lived Instagram token.");
  return await response.json() as { access_token: string; token_type: string; expires_in: number };
}

export async function completeInstagramAuthorization(code: string, state: string) {
  const pending = await consumeOAuthState(state, "INSTAGRAM");

  const appUrl = requiredEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("META_APP_ID"),
      client_secret: requiredEnv("META_APP_SECRET"),
      grant_type: "authorization_code",
      redirect_uri: `${appUrl}/api/oauth/instagram/callback`,
      code
    }),
    cache: "no-store"
  });

  if (!tokenResponse.ok) throw new Error("Meta could not complete Instagram authorization.");
  const shortToken = await tokenResponse.json() as InstagramTokenResponse;
  if (!shortToken.access_token) throw new Error("Meta did not return an Instagram access token.");

  const longToken = await exchangeForLongLivedToken(shortToken.access_token);
  const profileUrl = new URL(`${GRAPH_URL}/me`);
  profileUrl.search = new URLSearchParams({
    fields: "user_id,username",
    access_token: longToken.access_token
  }).toString();

  const profileResponse = await fetch(profileUrl, { cache: "no-store" });
  if (!profileResponse.ok) throw new Error("We could not read your Instagram professional account.");
  const profile = await profileResponse.json() as InstagramProfile;
  const accountId = String(profile.user_id ?? profile.id ?? shortToken.user_id ?? "");
  if (!accountId) throw new Error("No eligible Instagram professional account was returned.");

  const encryptedRefreshToken = encryptToken(longToken.access_token);
  const expiresAt = new Date(Date.now() + longToken.expires_in * 1000);

  await prisma.socialAccount.upsert({
    where: {
      workspaceId_platform_platformAccountId: {
        workspaceId: pending.workspaceId,
        platform: "INSTAGRAM",
        platformAccountId: accountId
      }
    },
    create: {
      workspaceId: pending.workspaceId,
      platform: "INSTAGRAM",
      platformAccountId: accountId,
      username: profile.username ?? null,
      displayName: profile.username ? `@${profile.username}` : "Instagram professional account",
      encryptedAccessToken: encryptToken(longToken.access_token),
      encryptedRefreshToken,
      tokenExpiresAt: expiresAt,
      scopes: SCOPES
    },
    update: {
      username: profile.username ?? null,
      displayName: profile.username ? `@${profile.username}` : "Instagram professional account",
      encryptedAccessToken: encryptToken(longToken.access_token),
      encryptedRefreshToken,
      tokenExpiresAt: expiresAt,
      scopes: SCOPES
    }
  });

  await prisma.auditEvent.create({
    data: {
      workspaceId: pending.workspaceId,
      actorUserId: pending.userId,
      action: "social_account.connected",
      targetType: "SocialAccount",
      targetId: accountId,
      metadata: { platform: "INSTAGRAM" }
    }
  });

  return pending.workspaceId;
}

/**
 * Instagram long-lived tokens can be refreshed after they are at least 24 hours old
 * and before expiry. Refresh seven days before expiry to avoid an expired connection.
 */
export async function getValidInstagramAccessToken(socialAccountId: string) {
  const account = await prisma.socialAccount.findUnique({ where: { id: socialAccountId } });
  if (!account || account.platform !== "INSTAGRAM" || !account.encryptedAccessToken) {
    throw new Error("The Instagram account is not connected. Please reconnect it.");
  }

  const refreshWindow = Date.now() + 7 * 24 * 60 * 60 * 1000;
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() > refreshWindow) {
    return decryptToken(account.encryptedAccessToken);
  }

  const currentToken = decryptToken(account.encryptedAccessToken);
  const url = new URL(`${GRAPH_URL}/refresh_access_token`);
  url.search = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: currentToken
  }).toString();

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Meta could not refresh this Instagram connection. Please reconnect the account.");
  }

  const refreshed = await response.json() as { access_token: string; token_type: string; expires_in: number };
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await prisma.socialAccount.update({
    where: { id: account.id },
    data: {
      encryptedAccessToken: encryptToken(refreshed.access_token),
      encryptedRefreshToken: encryptToken(refreshed.access_token),
      tokenExpiresAt: expiresAt
    }
  });

  return refreshed.access_token;
}
