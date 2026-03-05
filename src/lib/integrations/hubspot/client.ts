import { getValidHubSpotToken } from "./token";

const HUBSPOT_OBJECT_TYPES = ["contacts", "companies", "deals", "tickets"] as const;

export interface HubSpotPropertyFields {
  dateFields: Array<{ key: string; label: string }>;
  filterProperties: Array<{
    key: string;
    label: string;
    values: Array<{ key: string; label: string }>;
  }>;
}

/**
 * Fetch date and single-select dropdown properties from HubSpot for metric configuration.
 * - Date fields: type date | datetime
 * - Filter properties: type enumeration with fieldType select | radio (max 1 keuze, geen multi-select)
 */
export async function fetchHubSpotProperties(
  clientId: string,
  objectType: string
): Promise<HubSpotPropertyFields> {
  if (!HUBSPOT_OBJECT_TYPES.includes(objectType as (typeof HUBSPOT_OBJECT_TYPES)[number])) {
    return { dateFields: [], filterProperties: [] };
  }

  const token = await getValidHubSpotToken(clientId);
  const res = await fetch(
    `https://api.hubapi.com/crm/v3/properties/${objectType}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HubSpot properties API: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      name: string;
      label: string;
      type: string;
      fieldType?: string;
      options?: Array<{ value: string; label: string; hidden?: boolean }>;
    }>;
  };

  const results = data.results ?? [];
  const dateFields: Array<{ key: string; label: string }> = [];
  const filterProperties: Array<{
    key: string;
    label: string;
    values: Array<{ key: string; label: string }>;
  }> = [];

  for (const p of results) {
    if (p.type === "date" || p.type === "datetime") {
      dateFields.push({ key: p.name, label: p.label });
    } else if (
      p.type === "enumeration" &&
      (p.fieldType === "select" || p.fieldType === "radio")
    ) {
      const options = (p.options ?? [])
        .filter((o) => !o.hidden)
        .map((o) => ({ key: o.value, label: o.label || o.value }));
      if (options.length > 0) {
        filterProperties.push({
          key: p.name,
          label: p.label,
          values: options,
        });
      }
    }
  }

  dateFields.sort((a, b) => a.label.localeCompare(b.label));
  filterProperties.sort((a, b) => a.label.localeCompare(b.label));

  return { dateFields, filterProperties };
}

export interface HubSpotMetricParams {
  objectType: string; // contacts | companies | deals | tickets
  metricType: string; // count_total | count_created | count_modified | count_by_lifecycle | count_won | count_open
  dateField?: string; // createdate | hs_lastmodifieddate | closedate
  filterProperty?: string; // lifecycle_stage | dealstage
  filterValue?: string; // lead | closedwon etc
}

/**
 * Parse HubSpot metricKey + category into params.
 * metricKey format: "metricType" or "metricType:dateField" or "metricType:filterProperty:filterValue"
 */
const LEGACY_OBJECT_MAP: Record<string, string> = {
  contacts_count: "contacts",
  companies_count: "companies",
  deals_count: "deals",
  tickets_count: "tickets",
};

export function parseHubSpotMetricKey(
  category: string,
  metricKey: string
): HubSpotMetricParams | null {
  // Legacy format: metricKey = "contacts_count", category = "CRM"
  const legacyObject = LEGACY_OBJECT_MAP[metricKey];
  if (legacyObject) {
    return { objectType: legacyObject, metricType: "count_total" };
  }

  const objectType = category;
  const parts = metricKey.split(":");

  if (parts[0] === "count_total") {
    return { objectType, metricType: "count_total" };
  }
  if (parts[0] === "count_created" && parts[1]) {
    return { objectType, metricType: "count_created", dateField: parts[1] };
  }
  if (parts[0] === "count_modified" && parts[1]) {
    return { objectType, metricType: "count_modified", dateField: parts[1] };
  }
  if (parts[0] === "count_by_lifecycle" && parts[1] && parts[2]) {
    return {
      objectType,
      metricType: "count_by_lifecycle",
      filterProperty: parts[1],
      filterValue: parts[2],
    };
  }
  if (parts[0] === "count_won") {
    return { objectType, metricType: "count_won", filterProperty: "dealstage", filterValue: "closedwon" };
  }
  if (parts[0] === "count_open") {
    return { objectType, metricType: "count_open", filterProperty: "dealstage", filterValue: "__open__" };
  }
  // count_filtered: filterProperty:filterValue:dateField
  if (parts[0] === "count_filtered" && parts[1] && parts[2] && parts[3]) {
    return {
      objectType,
      metricType: "count_filtered",
      filterProperty: parts[1],
      filterValue: parts[2],
      dateField: parts[3],
    };
  }

  return null;
}

/**
 * Fetch a HubSpot CRM metric.
 * @param excludeToday - Bij true: window eindigt op eind van gisteren (zelfde waarde bij meerdere refreshes per dag)
 * @param overrideWindow - Expliciet start/end timestamp (ms) voor tijdreeks-executie
 */
export async function fetchHubSpotMetric(
  clientId: string,
  category: string,
  metricKey: string,
  dateRangeDays: number = 30,
  options?: { excludeToday?: boolean; overrideWindow?: { start: number; end: number } }
): Promise<number> {
  const params = parseHubSpotMetricKey(category, metricKey);
  if (!params) {
    throw new Error(`Invalid HubSpot metric: ${category}/${metricKey}`);
  }

  const token = await getValidHubSpotToken(clientId);

  const now = Date.now();
  let windowEnd: number;
  let windowStart: number;

  if (options?.overrideWindow) {
    windowEnd = options.overrideWindow.end;
    windowStart = options.overrideWindow.start;
  } else if (options?.excludeToday) {
    const endOfYesterday = new Date();
    endOfYesterday.setDate(endOfYesterday.getDate() - 1);
    endOfYesterday.setHours(23, 59, 59, 999);
    windowEnd = endOfYesterday.getTime();
    windowStart = windowEnd - dateRangeDays * 24 * 60 * 60 * 1000;
  } else {
    windowEnd = now;
    windowStart = windowEnd - dateRangeDays * 24 * 60 * 60 * 1000;
  }

  let filterGroups: Array<{ filters: Array<Record<string, unknown>> }> = [];

  if (params.metricType === "count_total" && !params.filterProperty) {
    filterGroups = []; // no filter
  } else if (params.metricType === "count_created" && params.dateField) {
    filterGroups = [
      {
        filters: [
          {
            propertyName: params.dateField,
            operator: "BETWEEN",
            value: String(windowStart),
            highValue: String(windowEnd),
          },
        ],
      },
    ];
  } else if (params.metricType === "count_modified" && params.dateField) {
    filterGroups = [
      {
        filters: [
          {
            propertyName: params.dateField,
            operator: "BETWEEN",
            value: String(windowStart),
            highValue: String(windowEnd),
          },
        ],
      },
    ];
  } else if (params.metricType === "count_by_lifecycle" && params.filterProperty && params.filterValue) {
    filterGroups = [
      {
        filters: [
          {
            propertyName: params.filterProperty,
            operator: "EQ",
            value: params.filterValue,
          },
        ],
      },
    ];
  } else if (params.metricType === "count_won" && params.filterValue) {
    filterGroups = [
      {
        filters: [
          {
            propertyName: "dealstage",
            operator: "EQ",
            value: params.filterValue,
          },
        ],
      },
    ];
  } else if (params.metricType === "count_open") {
    filterGroups = [
      {
        filters: [
          {
            propertyName: "dealstage",
            operator: "NOT_IN",
            values: ["closedwon", "closedlost"],
          },
        ],
      },
    ];
  } else if (
    params.metricType === "count_filtered" &&
    params.filterProperty &&
    params.filterValue &&
    params.dateField
  ) {
    // Property filter + date filter (AND)
    filterGroups = [
      {
        filters: [
          {
            propertyName: params.filterProperty,
            operator: "EQ",
            value: params.filterValue,
          },
          {
            propertyName: params.dateField,
            operator: "BETWEEN",
            value: String(windowStart),
            highValue: String(windowEnd),
          },
        ],
      },
    ];
  }

  const body: Record<string, unknown> = {
    limit: 1,
  };
  if (filterGroups.length > 0) {
    body.filterGroups = filterGroups;
  }

  const res = await fetch(
    `https://api.hubapi.com/crm/v3/objects/${params.objectType}/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HubSpot API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { total?: number };
  return data.total ?? 0;
}
