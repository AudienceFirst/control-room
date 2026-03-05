import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { exchangeGa4Code } from "@/lib/integrations/ga4/oauth";

const COOKIE_NAME = "ga4_oauth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=ga4_missing_params", request.url)
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COOKIE_NAME)?.value;
  cookieStore.delete(COOKIE_NAME);

  if (!cookieValue) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=ga4_expired", request.url)
    );
  }

  let parsed: { nonce: string };
  try {
    parsed = JSON.parse(cookieValue);
  } catch {
    return NextResponse.redirect(
      new URL("/settings/clients?error=ga4_invalid_state", request.url)
    );
  }

  if (parsed.nonce !== state) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=ga4_csrf", request.url)
    );
  }

  if (!process.env.ENCRYPTION_KEY) {
    return NextResponse.redirect(
      new URL("/settings/clients?error=ga4_config", request.url)
    );
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/integrations/ga4/callback`;

  try {
    const tokens = await exchangeGa4Code({ code, redirectUri });

    await prisma.ga4Connection.deleteMany({});
    await prisma.ga4Connection.create({
      data: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token ?? ""),
        tokenExpiresAt: new Date(tokens.expiry_date),
        connectedBy: session.user.email ?? session.user.name ?? null,
      },
    });

    return NextResponse.redirect(
      new URL("/settings/clients?connected=ga4", request.url)
    );
  } catch (err) {
    console.error("[GA4] Callback error:", err);
    return NextResponse.redirect(
      new URL("/settings/clients?error=ga4_connect_failed", request.url)
    );
  }
}
