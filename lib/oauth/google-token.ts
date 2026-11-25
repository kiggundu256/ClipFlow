export class GoogleCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleCredentialError";
  }
}

export type GoogleRefreshTokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

type GoogleOAuthError = {
  error?: string;
  error_description?: string;
};

export async function refreshGoogleAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  fetcher?: typeof fetch;
}): Promise<GoogleRefreshTokenResponse> {
  const fetcher = input.fetcher ?? fetch;
  let response: Response;

  try {
    response = await fetcher(input.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: input.clientId,
        client_secret: input.clientSecret,
        refresh_token: input.refreshToken,
        grant_type: "refresh_token"
      }),
      cache: "no-store"
    });
  } catch {
    throw new Error("Google could not be reached to refresh this YouTube connection. Try publishing again shortly.");
  }

  let payload: GoogleRefreshTokenResponse & GoogleOAuthError;
  try {
    payload = await response.json() as GoogleRefreshTokenResponse & GoogleOAuthError;
  } catch {
    throw new Error("Google returned an unreadable token refresh response. Try again shortly.");
  }

  if (!response.ok) {
    if (payload.error === "invalid_grant" || payload.error === "invalid_client" || payload.error === "unauthorized_client") {
      throw new GoogleCredentialError("The YouTube connection has been revoked or is no longer valid. Reconnect the channel before publishing.");
    }
    if (response.status === 429 || response.status >= 500) {
      throw new Error("Google is temporarily unable to refresh this YouTube connection. Try publishing again shortly.");
    }
    throw new UnrecoverableError("Google rejected the YouTube token refresh. Reconnect the channel before publishing.");
  }

  if (
    typeof payload.access_token !== "string" ||
    payload.access_token.length === 0 ||
    typeof payload.expires_in !== "number" ||
    !Number.isFinite(payload.expires_in) ||
    payload.expires_in <= 0
  ) {
    throw new Error("Google returned an invalid token refresh response. Reconnect the channel before publishing.");
  }

  return {
    access_token: payload.access_token,
    expires_in: payload.expires_in,
    ...(payload.scope ? { scope: payload.scope } : {})
  };
}
