import { fetchGA4PageCount } from "@/lib/integrations/ga4/client";
import { fetchHubSpotMetric } from "@/lib/integrations/hubspot/client";
import type { FunnelData, FunnelStepDef, FunnelStepResult } from "@/types/funnel";

/** 30-day window, excluding today (same as metrics). */
function getDateRange(): { startDate: string; endDate: string } {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const endStr = yesterday.toISOString().slice(0, 10);
  const startDate = new Date(yesterday);
  startDate.setDate(startDate.getDate() - 29);
  const startStr = startDate.toISOString().slice(0, 10);
  return { startDate: startStr, endDate: endStr };
}

export type FunnelFetchInput = {
  steps: FunnelStepDef[];
  campaignNames: string[];
  ga4PropertyId: string | null;
  hasHubSpot: boolean;
  clientId: string;
};

/**
 * Fetch funnel step values from GA4 and HubSpot.
 * Runs all steps in parallel where possible; GA4 steps are parallelized.
 */
export async function fetchFunnelData(input: FunnelFetchInput): Promise<FunnelData> {
  const { steps, campaignNames, ga4PropertyId, hasHubSpot, clientId } = input;
  const { startDate, endDate } = getDateRange();
  const campaignList = Array.isArray(campaignNames) ? campaignNames : [];

  const results: FunnelStepResult[] = await Promise.all(
    steps
      .sort((a, b) => a.order - b.order)
      .map(async (step): Promise<FunnelStepResult> => {
        if (step.type === "ga4_page") {
          if (!ga4PropertyId) {
            return { order: step.order, label: step.label, value: 0, type: "ga4_page" };
          }
          try {
            const value = await fetchGA4PageCount({
              propertyId: ga4PropertyId,
              pagePathContains: step.ga4PagePath,
              campaignNames: campaignList,
              startDate,
              endDate,
              metricName: "activeUsers",
            });
            return { order: step.order, label: step.label, value, type: "ga4_page" };
          } catch {
            return { order: step.order, label: step.label, value: 0, type: "ga4_page" };
          }
        }

        if (step.type === "hubspot_contacts") {
          if (!hasHubSpot) {
            return { order: step.order, label: step.label, value: 0, type: "hubspot_contacts" };
          }
          try {
            const value = await fetchHubSpotMetric(
              clientId,
              "contacts",
              `count_by_lifecycle:lifecycle_stage:${step.hubspotLifecycleStage}`,
              30,
              { excludeToday: true }
            );
            return { order: step.order, label: step.label, value, type: "hubspot_contacts" };
          } catch {
            return { order: step.order, label: step.label, value: 0, type: "hubspot_contacts" };
          }
        }

        const s = step as { order: number; label: string; type: string };
        return { order: s.order, label: s.label, value: 0, type: s.type as FunnelStepDef["type"] };
      })
  );

  return {
    steps: results.sort((a, b) => a.order - b.order),
    campaignNames: campaignList,
  };
}
