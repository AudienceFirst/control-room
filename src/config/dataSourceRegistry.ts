import { GA4_METRIC_CATALOG } from "./ga4MetricCatalog";
import { HUBSPOT_METRICS, HUBSPOT_OBJECTS } from "./hubspotMetricCatalog";

export type DataSourceField = {
  key: string;
  label: string;
  unit: "count" | "percentage" | "currency" | "seconds" | "score";
  category: string;
};

export type DataSourceDefinition = {
  id: string;
  label: string;
  fields: DataSourceField[];
};

function ga4Unit(key: string): DataSourceField["unit"] {
  if (key === "bounceRate" || key === "engagementRate" || key === "sessionConversionRate") return "percentage";
  if (key === "purchaseRevenue") return "currency";
  if (key === "averageSessionDuration" || key === "userEngagementDuration") return "seconds";
  return "count";
}

const ga4Fields: DataSourceField[] = Object.entries(GA4_METRIC_CATALOG).flatMap(
  ([category, metrics]) =>
    (metrics as ReadonlyArray<{ key: string; label: string }>).map((m) => ({
      key: m.key,
      label: m.label,
      unit: ga4Unit(m.key),
      category,
    }))
);

const hubspotFields: DataSourceField[] = HUBSPOT_OBJECTS.flatMap((obj) =>
  (HUBSPOT_METRICS[obj.key] ?? [])
    .filter((m) => !m.needsDateField && !m.needsFilterProperty)
    .map((m) => ({
      key: `${obj.key}:${m.key}`,
      label: `${obj.label} – ${m.label}`,
      unit: "count" as const,
      category: obj.label,
    }))
);

const clickupFields: DataSourceField[] = [
  { key: "incompleteCount", label: "Open taken", unit: "count", category: "ClickUp" },
  { key: "overdueCount", label: "Verlopen taken", unit: "count", category: "ClickUp" },
  { key: "recentlyCompletedCount", label: "Afgerond (7d)", unit: "count", category: "ClickUp" },
];

const sentimentFields: DataSourceField[] = [
  { key: "overallScore", label: "Sentiment score", unit: "score", category: "Sentiment" },
  { key: "emailsAnalyzed", label: "E-mails geanalyseerd", unit: "count", category: "Sentiment" },
];

export const DATA_SOURCE_REGISTRY: DataSourceDefinition[] = [
  { id: "GA4", label: "Google Analytics 4", fields: ga4Fields },
  { id: "HUBSPOT", label: "HubSpot CRM", fields: hubspotFields },
  { id: "CLICKUP", label: "ClickUp", fields: clickupFields },
  { id: "SENTIMENT", label: "Gmail Sentiment", fields: sentimentFields },
];

export function getDataSourceById(id: string): DataSourceDefinition | undefined {
  return DATA_SOURCE_REGISTRY.find((ds) => ds.id === id);
}

export function getFieldBySourceAndKey(
  sourceId: string,
  key: string
): DataSourceField | undefined {
  return getDataSourceById(sourceId)?.fields.find((f) => f.key === key);
}
