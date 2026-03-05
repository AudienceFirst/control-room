import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { exchangeHubSpotCode } from "@/lib/integrations/hubspot/oauth";

const COOKIE_NAME = "hubspot_oauth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=hubspot_missing_params", request.url)
    );
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COOKIE_NAME)?.value;
  cookieStore.delete(COOKIE_NAME);

  if (!cookieValue) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=hubspot_expired", request.url)
    );
  }

  let parsed: { nonce: string; clientId: string };
  try {
    parsed = JSON.parse(cookieValue);
  } catch {
    return NextResponse.redirect(
      new URL("/settings/clients?error=hubspot_invalid_state", request.url)
    );
  }

  if (parsed.nonce !== state) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=hubspot_csrf", request.url)
    );
  }

  const { clientId } = parsed;

  if (!process.env.ENCRYPTION_KEY) {
    console.error("[HubSpot] ENCRYPTION_KEY is not set");
    return NextResponse.redirect(
      new URL(`/settings/clients/${clientId}?error=hubspot_config`, request.url)
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/integrations/hubspot/callback`;

  try {
    const tokens = await exchangeHubSpotCode({ code, redirectUri });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    let portalId = "pending";
    let hubDomain: string | null = null;

    try {
      const accountRes = await fetch(
        "https://api.hubapi.com/account-info/v3/details",
        {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        }
      );
      if (accountRes.ok) {
        const account = await accountRes.json();
        portalId = String(account.portalId ?? account.id ?? "pending");
        hubDomain = account.uiDomain ?? account.domain ?? null;
      }
    } catch {
      // Continue without portal info
    }

    const scopes = [
      "crm.objects.contacts.read",
      "crm.objects.deals.read",
      "crm.objects.companies.read",
      "oauth",
    ].join(",");

    await prisma.hubSpotConnection.upsert({
      where: { clientId },
      update: {
        portalId,
        hubDomain,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token ?? ""),
        tokenExpiresAt: expiresAt,
        lastRefreshedAt: new Date(),
        isValid: true,
        scopes,
      },
      create: {
        clientId,
        portalId,
        hubDomain,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token ?? ""),
        tokenExpiresAt: expiresAt,
        scopes,
      },
    });

    return NextResponse.redirect(
      new URL(`/settings/clients/${clientId}?connected=hubspot`, request.url)
    );
  } catch (err) {
    console.error("[HubSpot] Callback error:", err);
    return NextResponse.redirect(
      new URL(`/settings/clients/${clientId}?error=hubspot_connect_failed`, request.url)
    );
  }
}
