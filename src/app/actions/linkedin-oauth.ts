"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getLinkedInAuthUrl } from "@/lib/integrations/linkedin/oauth";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

const COOKIE_NAME = "linkedin_oauth";
const COOKIE_MAX_AGE = 600; // 10 min

export async function getLinkedInConnectUrl(clientId: string): Promise<string> {
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

  const baseUrl = (
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3001"
  ).replace(/\/$/, "");
  const redirectUri = `${baseUrl}/api/integrations/linkedin/callback`;

  return getLinkedInAuthUrl({ redirectUri, state: nonce });
}

export async function disconnectLinkedIn(clientId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.linkedInConnection.deleteMany({ where: { clientId } });

  // Remove any LinkedIn MetricConfigs for this client
  await prisma.metricConfig.deleteMany({
    where: { clientId, dataSource: "LINKEDIN" },
  });

  revalidatePath(`/settings/clients/${clientId}`);
  revalidatePath("/control-room");
}
