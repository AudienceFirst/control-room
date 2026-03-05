"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { fetchGA4Metric } from "@/lib/integrations/ga4/client";

export async function saveGA4Config(clientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const ga4PropertyId = (formData.get("ga4PropertyId") as string)?.trim();
  if (!ga4PropertyId) throw new Error("GA4 property ID is required");

  // Validate by fetching a simple metric (sessions for today)
  const today = new Date().toISOString().slice(0, 10);
  await fetchGA4Metric({
    propertyId: ga4PropertyId,
    metricName: "sessions",
    startDate: today,
    endDate: today,
  });

  await prisma.ga4Config.upsert({
    where: { clientId },
    update: { ga4PropertyId, updatedAt: new Date() },
    create: { clientId, ga4PropertyId },
  });

  revalidatePath(`/settings/clients/${clientId}`);
  revalidatePath("/control-room");
  return { success: true };
}

export async function removeGA4Config(clientId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.ga4Config.deleteMany({ where: { clientId } });
  revalidatePath(`/settings/clients/${clientId}`);
  revalidatePath("/control-room");
  return { success: true };
}
