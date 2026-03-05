"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { fetchGA4Metric } from "@/lib/integrations/ga4/client";
import {
  fetchHubSpotMetric,
  fetchHubSpotProperties,
  type HubSpotPropertyFields,
} from "@/lib/integrations/hubspot/client";
import { revalidatePath } from "next/cache";

export async function getHubSpotPropertiesForMetric(
  clientId: string,
  objectType: string
): Promise<HubSpotPropertyFields> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return fetchHubSpotProperties(clientId, objectType);
}

export async function addMetricConfig(
  clientId: string,
  data: {
    label: string;
    dataSource: "GA4" | "HUBSPOT";
    metricKey: string;
    category: string;
    hubspotDateField?: string | null;
    hubspotFilterProperty?: string | null;
    hubspotFilterValue?: string | null;
    thresholdLow?: number | null;
    thresholdHigh?: number | null;
    thresholdUnit?: string | null;
  }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  let metricKey = data.metricKey;
  if (data.dataSource === "HUBSPOT") {
    if (data.metricKey === "count_filtered" && data.hubspotFilterProperty && data.hubspotFilterValue && data.hubspotDateField) {
      metricKey = `count_filtered:${data.hubspotFilterProperty}:${data.hubspotFilterValue}:${data.hubspotDateField}`;
    } else if (data.hubspotDateField) {
      metricKey = `${data.metricKey}:${data.hubspotDateField}`;
    } else if (data.metricKey === "count_by_lifecycle" && data.hubspotFilterValue) {
      metricKey = `count_by_lifecycle:lifecycle_stage:${data.hubspotFilterValue}`;
    }
  }

  await prisma.metricConfig.create({
    data: {
      clientId,
      label: data.label,
      dataSource: data.dataSource,
      metricKey,
      category: data.category,
      thresholdLow: data.thresholdLow ?? undefined,
      thresholdHigh: data.thresholdHigh ?? undefined,
      thresholdUnit: data.thresholdUnit ?? undefined,
    },
  });

  revalidatePath(`/settings/clients/${clientId}`);
  revalidatePath("/control-room");
  return { success: true };
}

export async function updateMetricConfig(
  metricConfigId: string,
  clientId: string,
  data: {
    label?: string;
    thresholdLow?: number | null;
    thresholdHigh?: number | null;
  }
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const config = await prisma.metricConfig.update({
    where: { id: metricConfigId },
    data: {
      ...(data.label != null && { label: data.label }),
      ...(data.thresholdLow !== undefined && { thresholdLow: data.thresholdLow }),
      ...(data.thresholdHigh !== undefined && { thresholdHigh: data.thresholdHigh }),
    },
  });

  // Recompute alertStatus for latest snapshot when thresholds changed
  if (
    data.thresholdLow !== undefined ||
    data.thresholdHigh !== undefined
  ) {
    const latest = await prisma.metricSnapshot.findFirst({
      where: { metricConfigId },
      orderBy: { capturedAt: "desc" },
    });
    if (latest) {
      const thresholdLow = data.thresholdLow !== undefined ? data.thresholdLow : config.thresholdLow;
      const thresholdHigh = data.thresholdHigh !== undefined ? data.thresholdHigh : config.thresholdHigh;
      const alertStatus =
        thresholdLow != null && latest.value < thresholdLow
          ? "LOW"
          : thresholdHigh != null && latest.value > thresholdHigh
            ? "HIGH"
            : "NORMAL";

      await prisma.metricSnapshot.update({
        where: { id: latest.id },
        data: { alertStatus },
      });
    }
  }

  revalidatePath(`/settings/clients/${clientId}`);
  revalidatePath("/control-room");
  return { success: true };
}

export async function removeMetricConfig(metricConfigId: string, clientId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.metricConfig.delete({ where: { id: metricConfigId } });
  revalidatePath(`/settings/clients/${clientId}`);
  revalidatePath("/control-room");
  return { success: true };
}

export async function refreshMetricValue(metricConfigId: string): Promise<number | null> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const config = await prisma.metricConfig.findUnique({
    where: { id: metricConfigId },
    include: {
      client: {
        include: { ga4Config: true, hubspotConnection: true },
      },
    },
  });
  if (!config) return null;

  let value: number;

  if (config.dataSource === "GA4") {
    const ga4Config = config.client.ga4Config;
    if (!ga4Config) return null;
    // 30 dagen exclusief vandaag: einddatum = gisteren, zodat 2x refreshen op een dag geen invloed heeft
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const endStr = yesterday.toISOString().slice(0, 10);
    const startDate = new Date(yesterday);
    startDate.setDate(startDate.getDate() - 29); // 30 dagen totaal (incl. gisteren)
    const startStr = startDate.toISOString().slice(0, 10);
    value = await fetchGA4Metric({
      propertyId: ga4Config.ga4PropertyId,
      metricName: config.metricKey,
      startDate: startStr,
      endDate: endStr,
    });
  } else if (config.dataSource === "HUBSPOT") {
    const hubspot = config.client.hubspotConnection;
    if (!hubspot) return null;
    value = await fetchHubSpotMetric(config.clientId, config.category, config.metricKey, 30, {
      excludeToday: true,
    });
  } else {
    return null;
  }

  // Window: 30 dagen exclusief vandaag (voor consistente waarden bij meerdere refreshes per dag)
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() - 1);
  windowEnd.setHours(23, 59, 59, 999);
  const windowStart = new Date(windowEnd);
  windowStart.setDate(windowStart.getDate() - 29);

  const latest = await prisma.metricSnapshot.findFirst({
    where: { metricConfigId },
    orderBy: { capturedAt: "desc" },
  });

  const alertStatus =
    config.thresholdLow != null && value < config.thresholdLow
      ? "LOW"
      : config.thresholdHigh != null && value > config.thresholdHigh
        ? "HIGH"
        : "NORMAL";

  await prisma.metricSnapshot.create({
    data: {
      metricConfigId,
      windowStart,
      windowEnd,
      value,
      previousValue: latest?.value ?? undefined,
      alertStatus,
    },
  });

  revalidatePath(`/settings/clients/${config.clientId}`);
  revalidatePath("/control-room");
  return value;
}
