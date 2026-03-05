"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updateFunnelCampaigns(
  clientId: string,
  campaignNames: string[]
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { funnelConfig: true },
  });
  if (!client) return { success: false, error: "Client not found" };

  const normalized = campaignNames
    .map((s) => s.trim())
    .filter(Boolean);

  if (client.funnelConfig) {
    await prisma.funnelConfig.update({
      where: { id: client.funnelConfig.id },
      data: { campaignNames: JSON.stringify(normalized), updatedAt: new Date() },
    });
  } else {
    return { success: false, error: "No funnel configured for this client" };
  }

  revalidatePath(`/settings/clients/${clientId}`);
  revalidatePath(`/d/${client.slug}`);
  return { success: true };
}
