/**
 * Mock ad platform data for the Nieuwestroom Orderstraatbooster-Q1 campaign.
 *
 * Represents data that will eventually be fetched from:
 *   - Google Ads API (google_ads_client / Manager account)
 *   - Meta Marketing API (facebook.com/business/help)
 *   - LinkedIn Marketing API (developer.linkedin.com)
 *
 * UTM conventions:
 *   Google  → utm_source=google   & utm_medium=google_cpc
 *   LinkedIn→ utm_source=linkedin & utm_medium=paid_social
 *   Meta    → utm_source=<site_source_name> (facebook|instagram|messenger|…) & utm_medium=paid_social
 */

import type { UtmContent, UtmTerm } from "@/types/funnel";

export type AdPlatformKey = "google" | "linkedin" | "meta";

export interface AdMockRow {
  campaign: string;
  platform: AdPlatformKey;
  utmSource: string;
  utmMedium: string;
  utmTerm: UtmTerm;
  utmContent: UtmContent;
  impressions: number;
  clicks: number;
  /** Ad spend in EUR (excl. VAT). */
  spend: number;
}

/**
 * 30-day mock dataset for Orderstraatbooster-Q1.
 * Each row = one ad set × targeting combination.
 */
export const MOCK_AD_DATA: AdMockRow[] = [
  // ── Google Ads ────────────────────────────────────────────────────────────
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "google",
    utmSource: "google",
    utmMedium: "google_cpc",
    utmTerm: "Dynamische_Tarieven",
    utmContent: "static_algemeen",
    impressions: 45_230,
    clicks: 1_340,
    spend: 2_890,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "google",
    utmSource: "google",
    utmMedium: "google_cpc",
    utmTerm: "Dynamische_Tarieven",
    utmContent: "carrousel_algemeen",
    impressions: 38_900,
    clicks: 1_050,
    spend: 2_340,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "google",
    utmSource: "google",
    utmMedium: "google_cpc",
    utmTerm: "Energiepartners",
    utmContent: "static_algemeen",
    impressions: 29_100,
    clicks: 870,
    spend: 1_760,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "google",
    utmSource: "google",
    utmMedium: "google_cpc",
    utmTerm: "Energiepartners",
    utmContent: "carrousel_algemeen",
    impressions: 22_600,
    clicks: 680,
    spend: 1_420,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "google",
    utmSource: "google",
    utmMedium: "google_cpc",
    utmTerm: "Beste_energieleverancier",
    utmContent: "static_recreatie",
    impressions: 17_400,
    clicks: 520,
    spend: 1_180,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "google",
    utmSource: "google",
    utmMedium: "google_cpc",
    utmTerm: "Beste_energieleverancier",
    utmContent: "carrousel_recreatie",
    impressions: 14_100,
    clicks: 420,
    spend: 940,
  },

  // ── LinkedIn ───────────────────────────────────────────────────────────────
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "linkedin",
    utmSource: "linkedin",
    utmMedium: "paid_social",
    utmTerm: "Dynamische_Tarieven",
    utmContent: "static_algemeen",
    impressions: 18_700,
    clicks: 320,
    spend: 1_890,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "linkedin",
    utmSource: "linkedin",
    utmMedium: "paid_social",
    utmTerm: "Dynamische_Tarieven",
    utmContent: "carrousel_algemeen",
    impressions: 14_200,
    clicks: 240,
    spend: 1_450,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "linkedin",
    utmSource: "linkedin",
    utmMedium: "paid_social",
    utmTerm: "Energiepartners",
    utmContent: "static_detailhandel",
    impressions: 11_600,
    clicks: 185,
    spend: 1_180,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "linkedin",
    utmSource: "linkedin",
    utmMedium: "paid_social",
    utmTerm: "Beste_energieleverancier",
    utmContent: "carrousel_detailhandel",
    impressions: 8_400,
    clicks: 130,
    spend: 870,
  },

  // ── Meta (Facebook + Instagram) ───────────────────────────────────────────
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "meta",
    utmSource: "facebook",
    utmMedium: "paid_social",
    utmTerm: "Dynamische_Tarieven",
    utmContent: "static_algemeen",
    impressions: 87_300,
    clicks: 2_100,
    spend: 3_450,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "meta",
    utmSource: "instagram",
    utmMedium: "paid_social",
    utmTerm: "Dynamische_Tarieven",
    utmContent: "carrousel_algemeen",
    impressions: 62_400,
    clicks: 1_580,
    spend: 2_760,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "meta",
    utmSource: "facebook",
    utmMedium: "paid_social",
    utmTerm: "Energiepartners",
    utmContent: "static_recreatie",
    impressions: 41_200,
    clicks: 980,
    spend: 1_890,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "meta",
    utmSource: "instagram",
    utmMedium: "paid_social",
    utmTerm: "Energiepartners",
    utmContent: "carrousel_recreatie",
    impressions: 33_600,
    clicks: 760,
    spend: 1_540,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "meta",
    utmSource: "facebook",
    utmMedium: "paid_social",
    utmTerm: "Beste_energieleverancier",
    utmContent: "static_detailhandel",
    impressions: 28_900,
    clicks: 670,
    spend: 1_230,
  },
  {
    campaign: "Orderstraatbooster-Q1",
    platform: "meta",
    utmSource: "instagram",
    utmMedium: "paid_social",
    utmTerm: "Beste_energieleverancier",
    utmContent: "carrousel_detailhandel",
    impressions: 19_400,
    clicks: 420,
    spend: 890,
  },
];

export interface AdAggregates {
  impressions: number;
  clicks: number;
  spend: number;
}

/**
 * Filter and aggregate ad rows by utm_campaign, utm_source, utm_medium, utm_term, utm_content.
 * Pass "all" to skip filtering on that dimension.
 */
export function getAdAggregates(filters: {
  utmCampaign: string;
  utmSource: string;
  utmMedium: string;
  utmTerm: string;
  utmContent: string;
}): AdAggregates {
  const rows = MOCK_AD_DATA.filter((row) => {
    if (filters.utmCampaign !== "all" && row.campaign !== filters.utmCampaign) return false;
    if (filters.utmSource !== "all" && row.utmSource !== filters.utmSource) return false;
    if (filters.utmMedium !== "all" && row.utmMedium !== filters.utmMedium) return false;
    if (filters.utmTerm !== "all" && row.utmTerm !== filters.utmTerm) return false;
    if (filters.utmContent !== "all" && row.utmContent !== filters.utmContent) return false;
    return true;
  });

  return rows.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      spend: acc.spend + row.spend,
    }),
    { impressions: 0, clicks: 0, spend: 0 }
  );
}
