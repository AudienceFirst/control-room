import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { exchangeLinkedInCode } from "@/lib/integrations/linkedin/oauth";
import { fetchLinkedInManagedOrgs } from "@/lib/integrations/linkedin/client";

const COOKIE_NAME = "linkedin_oauth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/clients?error=linkedin_denied`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=linkedin_missing_params", request.url)
    );
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COOKIE_NAME)?.value;
  cookieStore.delete(COOKIE_NAME);

  if (!cookieValue) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=linkedin_expired", request.url)
    );
  }

  let parsed: { nonce: string; clientId: string };
  try {
    parsed = JSON.parse(cookieValue);
  } catch {
    return NextResponse.redirect(
      new URL("/settings/clients?error=linkedin_invalid_state", request.url)
    );
  }

  if (parsed.nonce !== state) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=linkedin_csrf", request.url)
    );
  }

  const { clientId } = parsed;

  if (!process.env.ENCRYPTION_KEY) {
    console.error("[LinkedIn] ENCRYPTION_KEY is not set");
    return NextResponse.redirect(
      new URL(`/settings/clients/${clientId}?error=linkedin_config`, request.url)
    );
  }

  const baseUrl = (
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    request.nextUrl.origin
  ).replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/integrations/linkedin/callback`;

  try {
    const tokens = await exchangeLinkedInCode({ code, redirectUri });
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Fetch the company pages this user administers
    const orgs = await fetchLinkedInManagedOrgs(tokens.access_token);

    if (orgs.length === 0) {
      return NextResponse.redirect(
        new URL(`/settings/clients/${clientId}?error=linkedin_no_pages`, request.url)
      );
    }

    // Use the first managed org (most accounts manage a single page)
    const org = orgs[0];

    await prisma.linkedInConnection.upsert({
      where: { clientId },
      update: {
        organizationId: org.id,
        organizationName: org.name,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token ?? ""),
        tokenExpiresAt: expiresAt,
        scopes: tokens.scope,
        lastRefreshedAt: new Date(),
        isValid: true,
      },
      create: {
        clientId,
        organizationId: org.id,
        organizationName: org.name,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token ?? ""),
        tokenExpiresAt: expiresAt,
        scopes: tokens.scope,
      },
    });

    return NextResponse.redirect(
      new URL(`/settings/clients/${clientId}?connected=linkedin`, request.url)
    );
  } catch (err) {
    console.error("[LinkedIn] Callback error:", err);
    return NextResponse.redirect(
      new URL(`/settings/clients/${clientId}?error=linkedin_connect_failed`, request.url)
    );
  }
}
