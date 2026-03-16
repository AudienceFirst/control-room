/**
 * GA4 dimension filters for metrics (e.g. filter newUsers by channel = Organic Search).
 * Format: dimension name → list of common values.
 */
export const GA4_DIMENSION_FILTERS = {
  sessionDefaultChannelGroup: {
    label: "Kanaal (Channel)",
    values: [
      { key: "Organic Search", label: "Organic Search" },
      { key: "Paid Search", label: "Paid Search" },
      { key: "Direct", label: "Direct" },
      { key: "Organic Social", label: "Organic Social" },
      { key: "Paid Social", label: "Paid Social" },
      { key: "Organic Video", label: "Organic Video" },
      { key: "Paid Video", label: "Paid Video" },
      { key: "Display", label: "Display" },
      { key: "Email", label: "Email" },
      { key: "Affiliates", label: "Affiliates" },
      { key: "Referral", label: "Referral" },
      { key: "Audio", label: "Audio" },
      { key: "SMS", label: "SMS" },
      { key: "Push", label: "Push" },
      { key: "Paid Shopping", label: "Paid Shopping" },
      { key: "Organic Shopping", label: "Organic Shopping" },
      { key: "Cross-Platform", label: "Cross-Platform" },
    ],
  },
  sessionSource: {
    label: "Bron (Source)",
    values: [
      { key: "google", label: "google" },
      { key: "(direct)", label: "(direct)" },
      { key: "facebook", label: "facebook" },
      { key: "instagram", label: "instagram" },
      { key: "linkedin", label: "linkedin" },
      { key: "twitter", label: "twitter" },
      { key: "bing", label: "bing" },
      { key: "yahoo", label: "yahoo" },
      { key: "newsletter", label: "newsletter" },
    ],
  },
  sessionMedium: {
    label: "Medium",
    values: [
      { key: "organic", label: "organic" },
      { key: "cpc", label: "cpc" },
      { key: "ppc", label: "ppc" },
      { key: "referral", label: "referral" },
      { key: "email", label: "email" },
      { key: "social", label: "social" },
      { key: "none", label: "none" },
    ],
  },
} as const;

export type GA4FilterDimension = keyof typeof GA4_DIMENSION_FILTERS;

/** Encode filter as "dimension:value" for storage. Empty string = no filter. */
export function encodeGa4Filter(dimension: string, value: string): string {
  if (!dimension?.trim() || !value?.trim()) return "";
  return `${dimension}:${value}`;
}

/** Parse ga4FilterKey into { dimension, value }. Returns null if empty. */
export function parseGa4Filter(filterKey: string): { dimension: string; value: string } | null {
  if (!filterKey?.trim()) return null;
  const colon = filterKey.indexOf(":");
  if (colon < 0) return null;
  const dimension = filterKey.slice(0, colon).trim();
  const value = filterKey.slice(colon + 1).trim();
  return dimension && value ? { dimension, value } : null;
}
