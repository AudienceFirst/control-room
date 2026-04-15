const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";

// r_organization_social: read follower stats for pages the user administers
// offline_access: enables refresh tokens (60-day access, 365-day refresh)
const DEFAULT_SCOPES = "r_organization_social offline_access openid profile";

export function getLinkedInAuthUrl(params: {
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(LINKEDIN_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID!);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", DEFAULT_SCOPES);
  url.searchParams.set("state", params.state);
  return url.toString();
}

export async function exchangeLinkedInCode(params: {
  code: string;
  redirectUri: string;
}): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  scope: string;
}> {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: params.redirectUri,
      code: params.code,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn token exchange failed: ${res.status} ${err}`);
  }

  return res.json();
}

export async function refreshLinkedInTokens(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  scope: string;
}> {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn token refresh failed: ${res.status} ${err}`);
  }

  return res.json();
}
