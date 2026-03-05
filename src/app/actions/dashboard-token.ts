"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  generateDashboardToken,
  verifyDashboardToken,
} from "@/lib/dashboard-token";
import { revalidatePath } from "next/cache";

const BASE_PATH = "/d";

function dashboardUrl(slug: string, token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
  const origin = base.startsWith("http") ? base : `https://${base}`;
  return `${origin}${BASE_PATH}/${slug}?token=${encodeURIComponent(token)}`;
}

/**
 * Get existing dashboard token for client, or create one (requires auth).
 * Returns the shareable URL only when creating; for existing tokens we don't expose the secret again.
 */
export async function getOrCreateDashboardToken(clientId: string): Promise<{
  success: boolean;
  url?: string;
  hasToken?: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { dashboardToken: true },
    });
    if (!client) {
      return { success: false, error: "Client not found" };
    }

    if (client.dashboardToken) {
      return {
        success: true,
        hasToken: true,
        url: undefined,
      };
    }

    const { token, tokenHash } = generateDashboardToken();
    await prisma.clientDashboardToken.create({
      data: {
        clientId,
        tokenHash,
      },
    });

    revalidatePath(`/settings/clients/${clientId}`);
    return {
      success: true,
      hasToken: true,
      url: dashboardUrl(client.slug, token),
    };
  } catch (err) {
    console.error("[Dashboard token] getOrCreate failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}

/**
 * Regenerate dashboard token for client; old link stops working (requires auth).
 */
export async function regenerateDashboardToken(clientId: string): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      return { success: false, error: "Client not found" };
    }

    const { token, tokenHash } = generateDashboardToken();
    await prisma.clientDashboardToken.upsert({
      where: { clientId },
      create: { clientId, tokenHash },
      update: { tokenHash, updatedAt: new Date() },
    });

    revalidatePath(`/settings/clients/${clientId}`);
    return {
      success: true,
      url: dashboardUrl(client.slug, token),
    };
  } catch (err) {
    console.error("[Dashboard token] regenerate failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed",
    };
  }
}

/**
 * Verify token for a client (by slug). Used by /d/[slug] when there is no session.
 * Returns true if the token matches the stored hash and is not expired.
 */
export async function verifyClientDashboardToken(
  slug: string,
  token: string | null
): Promise<boolean> {
  if (!token?.trim()) return false;
  try {
    const client = await prisma.client.findUnique({
      where: { slug },
      include: { dashboardToken: true },
    });
    if (!client?.dashboardToken) return false;
    if (
      client.dashboardToken.expiresAt &&
      client.dashboardToken.expiresAt < new Date()
    ) {
      return false;
    }
    return verifyDashboardToken(token.trim(), client.dashboardToken.tokenHash);
  } catch {
    return false;
  }
}

