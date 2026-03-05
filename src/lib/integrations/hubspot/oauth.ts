// Use app-eu1.hubspot.com for EU accounts; default is US (app.hubspot.com)
const HUBSPOT_AUTH_URL =
  process.env.HUBSPOT_REGION === "eu"
    ? "https://app-eu1.hubspot.com/oauth/authorize"
    : "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";

// Must EXACTLY match scopes in your HubSpot app Auth tab (Developers HubSpot)
// Override via HUBSPOT_SCOPES env - space-separated, e.g. "oauth crm.objects.contacts.read ..."
const DEFAULT_SCOPES =
  "oauth crm.objects.contacts.read crm.objects.deals.read crm.objects.companies.read crm.objects.users.read crm.objects.owners.read crm.objects.line_items.read crm.schemas.custom.read settings.users.read tickets";

export function getHubSpotAuthUrl(params: {
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(HUBSPOT_AUTH_URL);
  url.searchParams.set("client_id", process.env.HUBSPOT_CLIENT_ID!);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", process.env.HUBSPOT_SCOPES ?? DEFAULT_SCOPES);
  url.searchParams.set("state", params.state);
  return url.toString();
}

export async function exchangeHubSpotCode(params: {
  code: string;
  redirectUri: string;
}): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      redirect_uri: params.redirectUri,
      code: params.code,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HubSpot token exchange failed: ${res.status} ${err}`);
  }

  return res.json();
}

export async function refreshHubSpotTokens(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(HUBSPOT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HubSpot token refresh failed: ${res.status} ${err}`);
  }

  return res.json();
}
