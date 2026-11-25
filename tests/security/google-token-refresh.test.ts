import assert from "node:assert/strict";
import { test } from "node:test";
import { UnrecoverableError } from "bullmq";
import { refreshGoogleAccessToken } from "../../lib/oauth/google-token";

const input = {
  refreshToken: "refresh-token",
  clientId: "client-id",
  clientSecret: "client-secret",
  tokenUrl: "https://oauth2.googleapis.test/token"
};

test("refreshes an expired access token and returns validated expiry and scopes", async () => {
  let requestBody = "";
  const result = await refreshGoogleAccessToken({
    ...input,
    fetcher: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      requestBody = String(init?.body);
      return Response.json({
        access_token: "new-access-token",
        expires_in: 3600,
        scope: "https://www.googleapis.com/auth/youtube.upload"
      });
    }) as typeof fetch
  });

  assert.deepEqual(result, {
    access_token: "new-access-token",
    expires_in: 3600,
    scope: "https://www.googleapis.com/auth/youtube.upload"
  });
  assert.match(requestBody, /grant_type=refresh_token/);
  assert.match(requestBody, /refresh_token=refresh-token/);
});

test("identifies revoked or expired refresh credentials and requires reconnection", async () => {
  await assert.rejects(
    refreshGoogleAccessToken({
      ...input,
      fetcher: (async () => Response.json(
        { error: "invalid_grant", error_description: "Token has been expired or revoked." },
        { status: 400 }
      )) as typeof fetch
    }),
    (error: unknown) => error instanceof UnrecoverableError && /connection has been revoked or is no longer valid/.test(error.message)
  );
});

test("treats Google rate limits and server failures as temporary, not revoked credentials", async () => {
  for (const status of [429, 503]) {
    await assert.rejects(
      refreshGoogleAccessToken({
        ...input,
        fetcher: (async () => Response.json({ error: "temporarily_unavailable" }, { status })) as typeof fetch
      }),
      /temporarily unable to refresh/
    );
  }
});

test("rejects malformed successful token responses instead of persisting unusable credentials", async () => {
  await assert.rejects(
    refreshGoogleAccessToken({
      ...input,
      fetcher: (async () => Response.json({ access_token: "token", expires_in: 0 })) as typeof fetch
    }),
    /invalid token refresh response/
  );
});

test("reports network interruptions as retryable refresh failures", async () => {
  await assert.rejects(
    refreshGoogleAccessToken({
      ...input,
      fetcher: (async () => { throw new TypeError("network unavailable"); }) as typeof fetch
    }),
    /could not be reached/
  );
});

test("does not retry permanent Google OAuth client configuration failures", async () => {
  await assert.rejects(
    refreshGoogleAccessToken({
      ...input,
      fetcher: (async () => Response.json(
        { error: "invalid_client" },
        { status: 401 }
      )) as typeof fetch
    }),
    (error: unknown) => error instanceof UnrecoverableError && /[Rr]econnect the channel/.test(error.message)
  );
});
