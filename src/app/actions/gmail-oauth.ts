"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getGmailAuthUrl } from "@/lib/integrations/gmail/oauth";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

const COOKIE_NAME = "gmail_oauth";
const COOKIE_MAX_AGE = 600; // 10 min

export async function getGmailConnectUrl(clientId: string): Promise<string> {
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

  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3001";
  const redirectUri = `${baseUrl}/api/integrations/gmail/callback`;

  return getGmailAuthUrl({
    redirectUri,
    state: nonce,
  });
}

export async function disconnectGmail(clientId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.gmailConnection.deleteMany({ where: { clientId } });
  await prisma.sentimentSnapshot.deleteMany({ where: { clientId } });

  revalidatePath(`/settings/clients/${clientId}`);
  revalidatePath("/control-room");
}
