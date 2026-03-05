"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getHubSpotAuthUrl } from "@/lib/integrations/hubspot/oauth";
import { forceRefreshHubSpotToken } from "@/lib/integrations/hubspot/token";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

const COOKIE_NAME = "hubspot_oauth";
const COOKIE_MAX_AGE = 600; // 10 min

export async function getHubSpotConnectUrl(clientId: string): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const nonce = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify({ nonce, clientId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3001";
  const redirectUri = `${baseUrl}/api/integrations/hubspot/callback`;

  return getHubSpotAuthUrl({
    redirectUri,
    state: nonce,
  });
}

export async function refreshHubSpotConnection(clientId: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  try {
    await forceRefreshHubSpotToken(clientId);
    revalidatePath(`/settings/clients/${clientId}`);
    revalidatePath("/control-room");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Refresh mislukt",
    };
  }
}

export async function disconnectHubSpot(clientId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.hubSpotConnection.deleteMany({
    where: { clientId },
  });

  revalidatePath(`/settings/clients/${clientId}`);
  revalidatePath("/control-room");
}
