"use server";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { getGa4AuthUrl, exchangeGa4Code } from "@/lib/integrations/ga4/oauth";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

const COOKIE_NAME = "ga4_oauth";
const COOKIE_MAX_AGE = 600; // 10 min

export async function getGa4ConnectUrl(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const nonce = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify({ nonce }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  const baseUrl =
    process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3001";
  const redirectUri = `${baseUrl}/api/integrations/ga4/callback`;

  return getGa4AuthUrl({
    redirectUri,
    state: nonce,
  });
}

export async function disconnectGa4(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.ga4Connection.deleteMany({});
  revalidatePath("/settings/clients");
  revalidatePath("/control-room");
}
