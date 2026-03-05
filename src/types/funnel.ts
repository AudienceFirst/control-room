/**
 * Funnel step definition (stored in FunnelConfig.stepsJson).
 */
export type FunnelStepDef =
  | {
      order: number;
      label: string;
      type: "ga4_page";
      ga4PagePath: string; // path or substring to match (e.g. "/word-klant" or "klantworden.nieuwestroom.nl/flows/energy/postcode")
    }
  | {
      order: number;
      label: string;
      type: "hubspot_contacts";
      hubspotLifecycleStage: string; // e.g. "customer" for klant
    };

export type FunnelStepResult = {
  order: number;
  label: string;
  value: number;
  type: FunnelStepDef["type"];
};

export type FunnelData = {
  steps: FunnelStepResult[];
  campaignNames: string[];
};

/** Default funnel for Nieuwestroom: landing page → bestelstraat steps → klant. */
export const NIEUwestroom_FUNNEL_STEPS: FunnelStepDef[] = [
  { order: 1, label: "Landingpagina bereikt (word-klant)", type: "ga4_page", ga4PagePath: "/word-klant" },
  { order: 2, label: "Bestelstraat Stap 1 – Postcode", type: "ga4_page", ga4PagePath: "/flows/energy/postcode" },
  { order: 3, label: "Bestelstraat Stap 2 – Verbruik", type: "ga4_page", ga4PagePath: "/flows/energy/verbruik" },
  { order: 4, label: "Bestelstraat Stap 3 – Producten", type: "ga4_page", ga4PagePath: "/flows/energy/producten" },
  { order: 5, label: "Bestelstraat Stap 4 – Persoonlijke informatie", type: "ga4_page", ga4PagePath: "/flows/energy/persoonlijke-informatie" },
  { order: 6, label: "Bestelstraat Stap 5 – Aanvullende gegevens", type: "ga4_page", ga4PagePath: "/flows/energy/aanvullende-gegevens" },
  { order: 7, label: "Bestelstraat Stap 6 – Betaalgegevens", type: "ga4_page", ga4PagePath: "/flows/energy/betaalgegevens" },
  { order: 8, label: "Bestelstraat Stap 7 – Bevestigen", type: "ga4_page", ga4PagePath: "/flows/energy/bevestigen" },
  { order: 9, label: "Bestelstraat Stap 8 – TYP", type: "ga4_page", ga4PagePath: "" }, // placeholder, no path = skip or 0
  { order: 10, label: "Contactpersonen (Bestelstraat Stap 2 ingevuld) met levenscyclus Klant", type: "hubspot_contacts", hubspotLifecycleStage: "customer" },
];

// ─── Nieuwestroom Funnel (Extended) ──────────────────────────────────────────

/** Known campaign names for the Nieuwestroom funnel. */
export const UTM_CAMPAIGNS = ["Orderstraatbooster-Q1"] as const;
export type UtmCampaign = (typeof UTM_CAMPAIGNS)[number] | "all";

/** Default campaign — used as the pre-selected value in the filter. */
export const NIEUWESTROOM_CAMPAIGN = "Orderstraatbooster-Q1";

/** utm_source values observed in Nieuwestroom ad traffic. */
export const UTM_SOURCES = ["google", "linkedin", "facebook", "instagram"] as const;
export type UtmSource = (typeof UTM_SOURCES)[number] | "all";

/** utm_medium values used in Nieuwestroom campaigns. */
export const UTM_MEDIUMS = ["google_cpc", "paid_social"] as const;
export type UtmMedium = (typeof UTM_MEDIUMS)[number] | "all";

/** utm_term values (targeting / doelgroep). */
export const UTM_TERMS = [
  "Dynamische_Tarieven",
  "Energiepartners",
  "Beste_energieleverancier",
] as const;
export type UtmTerm = (typeof UTM_TERMS)[number] | "all";

/** utm_content values (ad set / variant). */
export const UTM_CONTENTS = [
  "static_algemeen",
  "carrousel_algemeen",
  "static_recreatie",
  "carrousel_recreatie",
  "static_detailhandel",
  "carrousel_detailhandel",
] as const;
export type UtmContent = (typeof UTM_CONTENTS)[number] | "all";

/** Active filter state for the Nieuwestroom funnel dashboard. */
export type NieuwestroomUtmFilters = {
  utmCampaign: UtmCampaign;
  utmSource: UtmSource;
  utmMedium: UtmMedium;
  utmTerm: UtmTerm;
  utmContent: UtmContent;
};

/** Which data system sourced a given funnel step. */
export type FunnelDataSource = "ad_platform" | "ga4" | "hubspot";

/** A single funnel step with computed conversion rate. */
export type EnrichedFunnelStep = {
  order: number;
  label: string;
  value: number;
  dataSource: FunnelDataSource;
  /** Percentage of the previous step's value. null for step 1. */
  conversionFromPrevious: number | null;
};

/** Top-level KPIs shown above the funnel. */
export type NieuwestroomFunnelKPIs = {
  totalSpend: number;
  totalKlanten: number;
  /** Cost per acquisition (spend / klanten). Infinity when klanten = 0. */
  cpa: number;
};

/** Complete data payload for the Nieuwestroom funnel view. */
export type NieuwestroomFunnelData = {
  steps: EnrichedFunnelStep[];
  kpis: NieuwestroomFunnelKPIs;
  filters: NieuwestroomUtmFilters;
  /** Whether ad data (impressions/clicks/spend) is sourced from mock. */
  isAdDataMock: boolean;
};
