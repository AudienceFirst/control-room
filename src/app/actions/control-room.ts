"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { refreshMetricValue } from "@/app/actions/metrics";
import { refreshSentiment } from "@/app/actions/sentiment";
import { revalidatePath } from "next/cache";

/** Mark a single highlight as seen for the current user (upsert by userId + highlightKey). */
export async function acknowledgeHighlight(highlightKey: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await prisma.highlightAcknowledgment.upsert({
      where: {
        userId_highlightKey: { userId: session.user.id, highlightKey },
      },
      create: { userId: session.user.id, highlightKey },
      update: { acknowledgedAt: new Date() },
    });
    revalidatePath("/control-room");
    return { success: true };
  } catch (err) {
    console.error("[Control Room] acknowledgeHighlight failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Mark as seen failed",
    };
  }
}

/** Mark all given highlight keys as seen for the current user. */
export async function acknowledgeAllHighlights(highlightKeys: string[]): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    await Promise.all(
      highlightKeys.map((highlightKey) =>
        prisma.highlightAcknowledgment.upsert({
          where: {
            userId_highlightKey: { userId: session.user!.id!, highlightKey },
          },
          create: { userId: session.user.id, highlightKey },
          update: { acknowledgedAt: new Date() },
        })
      )
    );
    revalidatePath("/control-room");
    return { success: true };
  } catch (err) {
    console.error("[Control Room] acknowledgeAllHighlights failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Mark all as seen failed",
    };
  }
}

/** Refresh all clients: metrics, sentiment, alle segmenten. ClickUp refreshes on page load. */
export async function refreshAllClientsData(): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const clients = await prisma.client.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    // Parallel uitvoeren zodat alle clients (alle segmenten) gegarandeerd vernieuwd worden
    await Promise.all(
      clients.map((client) =>
        refreshClientData(client.id).catch((err) => {
          console.warn(`[Control Room] Client ${client.id} refresh failed:`, err);
        })
      )
    );

    // Alle relevante paden revalideren zodat de UI overal verse data toont
    revalidatePath("/control-room");
    revalidatePath("/settings/clients");
    for (const client of clients) {
      revalidatePath(`/settings/clients/${client.id}`);
    }
    return { success: true };
  } catch (err) {
    console.error("[Control Room] Refresh all failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Refresh mislukt",
    };
  }
}

/** Refresh single client: metrics, sentiment. ClickUp data refreshes on page load. */
export async function refreshClientData(clientId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const configs = await prisma.metricConfig.findMany({
      where: { clientId },
      select: { id: true },
    });

    await refreshSentiment(clientId);
    await Promise.all(
      configs.map((c) =>
        refreshMetricValue(c.id).catch((err) => {
          console.warn(`[Control Room] Metric ${c.id} refresh failed:`, err);
        })
      )
    );

    revalidatePath("/control-room");
    revalidatePath(`/settings/clients/${clientId}`);
    return { success: true };
  } catch (err) {
    console.error("[Control Room] Refresh failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Refresh mislukt",
    };
  }
}
