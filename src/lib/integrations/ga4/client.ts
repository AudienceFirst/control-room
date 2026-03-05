import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { getValidGa4Token } from "./token";

function getServiceAccountCredentials() {
  const json =
    process.env.GOOGLE_GA4_SERVICE_ACCOUNT_JSON ??
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;
  return JSON.parse(json) as Record<string, unknown>;
}

let serviceAccountClient: BetaAnalyticsDataClient | null = null;

function getServiceAccountClient(): BetaAnalyticsDataClient {
  if (!serviceAccountClient) {
    const credentials = getServiceAccountCredentials();
    if (!credentials) {
      throw new Error(
        "No GA4 auth: Connect GA4 via OAuth in Settings, or set GOOGLE_GA4_SERVICE_ACCOUNT_JSON"
      );
    }
    serviceAccountClient = new BetaAnalyticsDataClient({
      credentials,
    });
  }
  return serviceAccountClient;
}

/**
 * Fetch a single metric from GA4 for a date range.
 * Uses OAuth (ruben@zuid.com / mcc@zuid.com) when connected, else service account.
 */
export async function fetchGA4Metric({
  propertyId,
  metricName,
  startDate,
  endDate,
}: {
  propertyId: string;
  metricName: string;
  startDate: string;
  endDate: string;
}): Promise<number> {
  const accessToken = await getValidGa4Token();

  if (accessToken) {
    // OAuth: use REST API with Bearer token
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          metrics: [{ name: metricName }],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GA4 API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
    };
    const value = data.rows?.[0]?.metricValues?.[0]?.value;
    return value ? Number(value) : 0;
  }

  // Service account fallback
  const client = getServiceAccountClient();
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: metricName }],
  });

  const value = response.rows?.[0]?.metricValues?.[0]?.value;
  return value ? Number(value) : 0;
}

/**
 * Fetch a count (e.g. activeUsers or sessions) for a GA4 property filtered by page path,
 * and optionally by session campaign name(s). Used for funnel steps.
 */
export async function fetchGA4PageCount({
  propertyId,
  pagePathContains,
  campaignNames = [],
  startDate,
  endDate,
  metricName = "activeUsers",
}: {
  propertyId: string;
  pagePathContains: string;
  campaignNames?: string[];
  startDate: string;
  endDate: string;
  metricName?: "activeUsers" | "sessions" | "screenPageViews";
}): Promise<number> {
  if (!pagePathContains.trim()) return 0;

  const dimensionFilter: Record<string, unknown> = {
    filter: {
      fieldName: "pagePath",
      stringFilter: {
        matchType: "CONTAINS",
        value: pagePathContains,
      },
    },
  };

  if (campaignNames.length > 0) {
    dimensionFilter.andGroup = {
      expressions: [
        {
          filter: {
            fieldName: "pagePath",
            stringFilter: {
              matchType: "CONTAINS",
              value: pagePathContains,
            },
          },
        },
        {
          filter: {
            fieldName: "sessionCampaignName",
            inListFilter: { values: campaignNames },
          },
        },
      ],
    };
    delete dimensionFilter.filter;
  }

  const body: Record<string, unknown> = {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }],
    dimensionFilter,
    metrics: [{ name: metricName }],
  };

  const accessToken = await getValidGa4Token();

  if (accessToken) {
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GA4 API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
    };
    const rows = data.rows ?? [];
    let total = 0;
    for (const row of rows) {
      const v = row.metricValues?.[0]?.value;
      if (v) total += Number(v);
    }
    return total;
  }

  const client = getServiceAccountClient();
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }],
    dimensionFilter: dimensionFilter as never,
    metrics: [{ name: metricName }],
  });

  const rows = response.rows ?? [];
  let total = 0;
  for (const row of rows) {
    const v = row.metricValues?.[0]?.value;
    if (v) total += Number(v);
  }
  return total;
}

/**
 * Fetch unique active users for a GA4 page path with full UTM dimension filtering.
 * Supports campaign, platform (source+medium), utm_term, and utm_content filters.
 *
 * UTM → GA4 dimension mapping:
 *   utm_campaign → sessionCampaignName
 *   utm_source   → sessionSource
 *   utm_medium   → sessionMedium
 *   utm_term     → sessionManualTerm
 *   utm_content  → sessionManualAdContent
 */
export async function fetchGA4PageCountFiltered({
  propertyId,
  pagePathContains,
  utmCampaign,
  utmSource,
  utmMedium,
  utmTerm,
  utmContent,
  startDate,
  endDate,
}: {
  propertyId: string;
  pagePathContains: string;
  /** Filter on sessionCampaignName. Omit or pass "all" to skip. */
  utmCampaign?: string;
  /** Filter on sessionSource. Omit or pass "all" to skip. */
  utmSource?: string;
  /** Filter on sessionMedium. Omit or pass "all" to skip. */
  utmMedium?: string;
  /** Filter on sessionManualTerm. Omit or pass "all" to skip. */
  utmTerm?: string;
  /** Filter on sessionManualAdContent. Omit or pass "all" to skip. */
  utmContent?: string;
  startDate: string;
  endDate: string;
}): Promise<number> {
  if (!pagePathContains.trim()) return 0;

  const expressions: Array<Record<string, unknown>> = [
    {
      filter: {
        fieldName: "pagePath",
        stringFilter: { matchType: "CONTAINS", value: pagePathContains },
      },
    },
  ];

  if (utmCampaign && utmCampaign !== "all") {
    expressions.push({
      filter: {
        fieldName: "sessionCampaignName",
        stringFilter: { matchType: "EXACT", value: utmCampaign },
      },
    });
  }

  if (utmSource && utmSource !== "all") {
    expressions.push({
      filter: { fieldName: "sessionSource", stringFilter: { matchType: "EXACT", value: utmSource } },
    });
  }

  if (utmMedium && utmMedium !== "all") {
    expressions.push({
      filter: { fieldName: "sessionMedium", stringFilter: { matchType: "EXACT", value: utmMedium } },
    });
  }

  if (utmTerm && utmTerm !== "all") {
    expressions.push({
      filter: {
        fieldName: "sessionManualTerm",
        stringFilter: { matchType: "EXACT", value: utmTerm },
      },
    });
  }

  if (utmContent && utmContent !== "all") {
    expressions.push({
      filter: {
        fieldName: "sessionManualAdContent",
        stringFilter: { matchType: "EXACT", value: utmContent },
      },
    });
  }

  const dimensionFilter =
    expressions.length === 1
      ? expressions[0]
      : { andGroup: { expressions } };

  const body: Record<string, unknown> = {
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }],
    dimensionFilter,
    metrics: [{ name: "activeUsers" }],
  };

  const accessToken = await getValidGa4Token();

  if (accessToken) {
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GA4 API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      rows?: Array<{ metricValues?: Array<{ value?: string }> }>;
    };
    let total = 0;
    for (const row of data.rows ?? []) {
      const v = row.metricValues?.[0]?.value;
      if (v) total += Number(v);
    }
    return total;
  }

  const client = getServiceAccountClient();
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }],
    dimensionFilter: dimensionFilter as never,
    metrics: [{ name: "activeUsers" }],
  });

  let total = 0;
  for (const row of response.rows ?? []) {
    const v = row.metricValues?.[0]?.value;
    if (v) total += Number(v);
  }
  return total;
}
