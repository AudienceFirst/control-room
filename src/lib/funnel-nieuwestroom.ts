/**
 * Nieuwestroom Orderstraatbooster-Q1 — 10-step funnel data fetcher.
 *
 * Step sources:
 *   1–9  → GA4 (unique active users per page, UTM-filtered)
 *   10   → HubSpot (contacts with lifecycle stage = klant)
 *
 * The GA4 steps filter on:
 *   sessionCampaignName = "Orderstraatbooster-Q1"
 *   sessionSource / sessionMedium  (per platform selection)
 *   sessionManualTerm              (utm_term / targeting)
 *   sessionManualAdContent         (utm_content / variant)
 */

import { fetchGA4PageCountFiltered } from "@/lib/integrations/ga4/client";
import { fetchHubSpotMetric } from "@/lib/integrations/hubspot/client";
import {
  type NieuwestroomFunnelData,
  type NieuwestroomUtmFilters,
  type EnrichedFunnelStep,
  type FunnelDataSource,
} from "@/types/funnel";

// ─── Step Definitions ────────────────────────────────────────────────────────

interface RawStepDef {
  order: number;
  label: string;
  dataSource: FunnelDataSource;
  /** GA4 steps: path substring to match. Empty = skip (returns 0). */
  ga4PagePath?: string;
  /** HubSpot steps: lifecycle stage value. */
  hubspotLifecycleStage?: string;
}

const FUNNEL_STEP_DEFS: RawStepDef[] = [
  // GA4 — Website & Bestelstraat
  { order: 1, label: "Landingspagina – word-klant", dataSource: "ga4", ga4PagePath: "/word-klant" },
  { order: 2, label: "Bestelstraat Stap 1 – Postcode", dataSource: "ga4", ga4PagePath: "/flows/energy/postcode" },
  { order: 3, label: "Bestelstraat Stap 2 – Verbruik", dataSource: "ga4", ga4PagePath: "/flows/energy/verbruik" },
  { order: 4, label: "Bestelstraat Stap 3 – Producten", dataSource: "ga4", ga4PagePath: "/flows/energy/producten" },
  {
    order: 5,
    label: "Bestelstraat Stap 4 – Persoonlijke informatie",
    dataSource: "ga4",
    ga4PagePath: "/flows/energy/persoonlijke-informatie",
  },
  {
    order: 6,
    label: "Bestelstraat Stap 5 – Aanvullende gegevens",
    dataSource: "ga4",
    ga4PagePath: "/flows/energy/aanvullende-gegevens",
  },
  { order: 7, label: "Bestelstraat Stap 6 – Betaalgegevens", dataSource: "ga4", ga4PagePath: "/flows/energy/betaalgegevens" },
  { order: 8, label: "Bestelstraat Stap 7 – Bevestigen", dataSource: "ga4", ga4PagePath: "/flows/energy/bevestigen" },
  {
    order: 9,
    label: "Bedanktpagina (TYP) – Bestelling geplaatst",
    dataSource: "ga4",
    ga4PagePath: "/flows/energy/bestelling-geplaatst",
  },

  // HubSpot — Bottom of Funnel
  {
    order: 10,
    label: "Klant (HubSpot lifecycle = klant)",
    dataSource: "hubspot",
    hubspotLifecycleStage: "customer",
  },
];

// ─── Date Range Helper ────────────────────────────────────────────────────────

function getDateRange(): { startDate: string; endDate: string } {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const endStr = yesterday.toISOString().slice(0, 10);
  const startDate = new Date(yesterday);
  startDate.setDate(startDate.getDate() - 29);
  return { startDate: startDate.toISOString().slice(0, 10), endDate: endStr };
}

// ─── Main Fetcher ─────────────────────────────────────────────────────────────

export interface NieuwestroomFunnelInput {
  filters: NieuwestroomUtmFilters;
  ga4PropertyId: string | null;
  hasHubSpot: boolean;
  clientId: string;
}

export async function fetchNieuwestroomFunnelData(
  input: NieuwestroomFunnelInput
): Promise<NieuwestroomFunnelData> {
  const { filters, ga4PropertyId, hasHubSpot, clientId } = input;
  const { startDate, endDate } = getDateRange();

  // ── GA4 + HubSpot steps (parallel) ───────────────────────────────────────
  const rawValues = await Promise.all(
    FUNNEL_STEP_DEFS.map(async (step): Promise<number> => {
      if (step.dataSource === "ga4") {
        if (!ga4PropertyId || !step.ga4PagePath?.trim()) return 0;
        try {
          return await fetchGA4PageCountFiltered({
            propertyId: ga4PropertyId,
            pagePathContains: step.ga4PagePath,
            utmCampaign: filters.utmCampaign !== "all" ? filters.utmCampaign : undefined,
            utmSource: filters.utmSource !== "all" ? filters.utmSource : undefined,
            utmMedium: filters.utmMedium !== "all" ? filters.utmMedium : undefined,
            utmTerm: filters.utmTerm !== "all" ? filters.utmTerm : undefined,
            utmContent: filters.utmContent !== "all" ? filters.utmContent : undefined,
            startDate,
            endDate,
          });
        } catch {
          return 0;
        }
      }

      if (step.dataSource === "hubspot" && step.hubspotLifecycleStage) {
        if (!hasHubSpot) return 0;
        try {
          // HubSpot lifecycle filter. UTM-level filtering within HubSpot requires
          // custom contact properties (e.g. hs_analytics_first_url or utm_campaign__c).
          // For now: lifecycle stage = customer, which aligns with the funnel definition.
          // TODO: add HubSpot UTM property filter when properties are confirmed.
          return await fetchHubSpotMetric(
            clientId,
            "contacts",
            `count_by_lifecycle:lifecycle_stage:${step.hubspotLifecycleStage}`,
            30,
            { excludeToday: true }
          );
        } catch {
          return 0;
        }
      }

      return 0;
    })
  );

  // ── 3. Enrich with conversion rates ──────────────────────────────────────
  const steps: EnrichedFunnelStep[] = FUNNEL_STEP_DEFS.map((step, i) => {
    const value = rawValues[i];
    const prevValue = i > 0 ? rawValues[i - 1] : null;
    const conversionFromPrevious =
      prevValue != null && prevValue > 0
        ? Math.round((value / prevValue) * 1000) / 10 // one decimal
        : null;

    return {
      order: step.order,
      label: step.label,
      value,
      dataSource: step.dataSource,
      conversionFromPrevious,
    };
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalKlanten = rawValues[rawValues.length - 1]; // laatste stap = HubSpot

  return {
    steps,
    kpis: { totalSpend: 0, totalKlanten, cpa: 0 },
    filters,
    isAdDataMock: false,
  };
}
