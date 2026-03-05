import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"];

export function getGa4AuthUrl(params: {
  redirectUri: string;
  state: string;
}): string {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    params.redirectUri
  );

  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: params.state,
  });
}

export async function exchangeGa4Code(params: {
  code: string;
  redirectUri: string;
}): Promise<{
  access_token: string;
  refresh_token: string | null;
  expiry_date: number;
}> {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    params.redirectUri
  );

  const { tokens } = await oauth2.getToken(params.code);
  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token ?? null,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600 * 1000,
  };
}
