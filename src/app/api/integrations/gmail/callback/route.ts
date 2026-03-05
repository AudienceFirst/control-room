import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { exchangeGmailCode } from "@/lib/integrations/gmail/oauth";
import { google } from "googleapis";

const COOKIE_NAME = "gmail_oauth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=gmail_missing_params", request.url)
    );
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COOKIE_NAME)?.value;
  cookieStore.delete(COOKIE_NAME);

  if (!cookieValue) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=gmail_expired", request.url)
    );
  }

  let parsed: { nonce: string; clientId: string };
  try {
    parsed = JSON.parse(cookieValue);
  } catch {
    return NextResponse.redirect(
      new URL("/settings/clients?error=gmail_invalid_state", request.url)
    );
  }

  if (parsed.nonce !== state) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=gmail_csrf", request.url)
    );
  }

  const { clientId } = parsed;

  if (!process.env.ENCRYPTION_KEY) {
    console.error("[Gmail] ENCRYPTION_KEY is not set");
    return NextResponse.redirect(
      new URL(`/settings/clients/${clientId}?error=gmail_config`, request.url)
    );
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/integrations/gmail/callback`;

  try {
    const tokens = await exchangeGmailCode({ code, redirectUri });
    const expiresAt = new Date(
      tokens.expiry_date ?? Date.now() + 3600 * 1000
    );

    let emailAddress = "unknown";
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { email?: string };
        if (data.email) emailAddress = data.email;
      }
      if (emailAddress === "unknown") {
        const oauth2 = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2.setCredentials({ access_token: tokens.access_token });
        const gmail = google.gmail({ version: "v1", auth: oauth2 });
        const { data } = await gmail.users.getProfile({ userId: "me" });
        emailAddress = data.emailAddress ?? "unknown";
      }
    } catch (err) {
      console.warn("[Gmail] Could not fetch email:", err);
    }

    await prisma.gmailConnection.upsert({
      where: { clientId },
      update: {
        emailAddress,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token ?? ""),
        tokenExpiresAt: expiresAt,
        lastRefreshedAt: new Date(),
        isValid: true,
      },
      create: {
        clientId,
        emailAddress,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token ?? ""),
        tokenExpiresAt: expiresAt,
      },
    });

    return NextResponse.redirect(
      new URL(`/settings/clients/${clientId}?connected=gmail&tab=sentiment`, request.url)
    );
  } catch (err) {
    console.error("[Gmail] Callback error:", err);
    return NextResponse.redirect(
      new URL(`/settings/clients/${clientId}?error=gmail_connect_failed`, request.url)
    );
  }
}
