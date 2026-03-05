"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  addMetricConfig,
  getHubSpotPropertiesForMetric,
  removeMetricConfig,
  refreshMetricValue,
  updateMetricConfig,
} from "@/app/actions/metrics";
import { GA4_METRIC_CATALOG } from "@/config/ga4MetricCatalog";
import {
  HUBSPOT_OBJECTS,
  HUBSPOT_METRICS,
} from "@/config/hubspotMetricCatalog";
import type { HubSpotPropertyFields } from "@/lib/integrations/hubspot/client";

interface MetricConfig {
  id: string;
  label: string;
  dataSource: string;
  metricKey: string;
  category: string;
  thresholdLow: number | null;
  thresholdHigh: number | null;
  thresholdUnit: string | null;
  snapshots: Array<{
    value: number;
    previousValue: number | null;
    alertStatus: string;
    capturedAt: Date;
  }>;
}

interface MetricsConfigTabProps {
  clientId: string;
  metrics: MetricConfig[];
  hasGa4: boolean;
  hasHubSpot: boolean;
}

export function MetricsConfigTab({
  clientId,
  metrics,
  hasGa4,
  hasHubSpot,
}: MetricsConfigTabProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMetric, setEditingMetric] = useState<MetricConfig | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  async function handleRefresh(id: string) {
    setRefreshing(id);
    try {
      await refreshMetricValue(id);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(null);
    }
  }

  const hasAnySource = hasGa4 || hasHubSpot;

  if (!hasAnySource) {
    return (
      <div className="rounded-xl border border-zinc-700/80 bg-zinc-800/40 p-6">
        <p className="text-zinc-400">
          Configureer eerst GA4 of HubSpot (tab Integraties) om metrics toe te voegen.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white">Metrics</h3>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
          >
            + Add Metric
          </button>
        </div>

        {metrics.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center">
            <p className="text-zinc-500">Nog geen metrics geconfigureerd</p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-4 rounded-lg bg-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
            >
              Eerste metric toevoegen
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {metrics.map((m) => {
              const latest = m.snapshots[0];
              const statusColor =
                latest?.alertStatus === "LOW"
                  ? "text-red-400"
                  : latest?.alertStatus === "HIGH"
                    ? "text-emerald-400"
                    : "text-blue-400";
              const isHubSpotTimeBounded =
                m.dataSource === "HUBSPOT" &&
                (m.metricKey.startsWith("count_created:") ||
                  m.metricKey.startsWith("count_modified:") ||
                  m.metricKey.startsWith("count_filtered:"));
              const windowLabel =
                m.dataSource === "GA4"
                  ? "30d"
                  : isHubSpotTimeBounded
                    ? "30d"
                    : "total";

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-700/80 bg-zinc-800/40 p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{m.label}</span>
                      <span className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-xs text-zinc-400">
                        {m.dataSource}
                      </span>
                      <span className={`text-xs ${statusColor}`}>
                        {latest?.alertStatus ?? "—"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">
                      {m.dataSource === "GA4"
                        ? `${m.category} · ${m.metricKey}`
                        : `${formatHubSpotObject(m.category)} · ${formatHubSpotMetricKey(m.metricKey)}`}
                    </p>
                    {latest && (
                      <p className="mt-1 text-sm text-zinc-400">
                        {windowLabel}: {formatValue(latest.value, m.thresholdUnit)}
                        {m.thresholdLow != null &&
                          ` | Low <${m.thresholdLow} (${m.dataSource === "GA4" ? "30d" : "total"})`}
                        {m.thresholdHigh != null &&
                          ` | High >${m.thresholdHigh} (${m.dataSource === "GA4" ? "30d" : "total"})`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingMetric(m)}
                      className="rounded-md px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white"
                    >
                      Bewerken
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRefresh(m.id)}
                      disabled={refreshing === m.id}
                      className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white disabled:opacity-50"
                      title="Vernieuwen"
                    >
                      <span className="text-lg">{refreshing === m.id ? "…" : "↻"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm("Metric verwijderen?")) {
                          await removeMetricConfig(m.id, clientId);
                          router.replace(`${pathname}?tab=metrics`);
                          router.refresh();
                        }
                      }}
                      className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      Verwijder
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddMetricModal
          clientId={clientId}
          hasGa4={hasGa4}
          hasHubSpot={hasHubSpot}
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            setShowAddModal(false);
            router.replace(`${pathname}?tab=metrics`);
            router.refresh();
          }}
        />
      )}

      {editingMetric && (
        <EditMetricModal
          metric={editingMetric}
          clientId={clientId}
          onClose={() => setEditingMetric(null)}
          onSaved={() => {
            setEditingMetric(null);
            router.replace(`${pathname}?tab=metrics`);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function inferUnit(metricKey: string, _dataSource: string): "count" | "percentage" | "currency" {
  if (
    metricKey === "bounceRate" ||
    metricKey === "engagementRate" ||
    metricKey === "sessionConversionRate"
  ) return "percentage";
  if (metricKey === "purchaseRevenue") return "currency";
  return "count";
}

function formatHubSpotObject(key: string): string {
  const obj = HUBSPOT_OBJECTS.find((o) => o.key === key);
  return obj?.label ?? key;
}

function formatHubSpotMetricKey(metricKey: string): string {
  if (metricKey.startsWith("count_created:")) {
    const field = metricKey.split(":")[1];
    return `Aantal aangemaakt (${field})`;
  }
  if (metricKey.startsWith("count_modified:")) {
    const field = metricKey.split(":")[1];
    return `Aantal gewijzigd (${field})`;
  }
  if (metricKey.startsWith("count_by_lifecycle:")) {
    const stage = metricKey.split(":")[2];
    return `Lifecycle: ${stage}`;
  }
  if (metricKey.startsWith("count_filtered:")) {
    const [, prop, val, dateField] = metricKey.split(":");
    return `${prop} = ${val} · ${dateField} (30d)`;
  }
  const labels: Record<string, string> = {
    count_total: "Totaal aantal",
    count_won: "Aantal gewonnen",
    count_open: "Aantal open",
  };
  return labels[metricKey] ?? metricKey;
}

function formatValue(value: number, unit: string | null): string {
  if (unit === "percentage") return `${value.toFixed(1)}%`;
  if (unit === "currency") return `€${value.toLocaleString("nl-NL")}`;
  return value.toLocaleString("nl-NL");
}

function EditMetricModal({
  metric,
  clientId,
  onClose,
  onSaved,
}: {
  metric: MetricConfig;
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(metric.label);
  const [thresholdLow, setThresholdLow] = useState(
    metric.thresholdLow != null ? String(metric.thresholdLow) : ""
  );
  const [thresholdHigh, setThresholdHigh] = useState(
    metric.thresholdHigh != null ? String(metric.thresholdHigh) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await updateMetricConfig(metric.id, clientId, {
        label: label.trim() || metric.label,
        thresholdLow: thresholdLow ? parseFloat(thresholdLow) : null,
        thresholdHigh: thresholdHigh ? parseFloat(thresholdHigh) : null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-metric-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-700/80 bg-zinc-900 p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 id="edit-metric-title" className="text-lg font-medium text-white">
            Metric bewerken
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            ×
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-500">
          {metric.dataSource === "GA4"
            ? `${metric.category} · ${metric.metricKey}`
            : `${formatHubSpotObject(metric.category)} · ${formatHubSpotMetricKey(metric.metricKey)}`}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">
              Low (alert wanneer &lt;)
            </label>
            <input
              type="number"
              value={thresholdLow}
              onChange={(e) => setThresholdLow(e.target.value)}
              placeholder="—"
              className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">
              High (alert wanneer &gt;)
            </label>
            <input
              type="number"
              value={thresholdHigh}
              onChange={(e) => setThresholdHigh(e.target.value)}
              placeholder="—"
              className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50"
            >
              {loading ? "Opslaan…" : "Opslaan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddMetricModal({
  clientId,
  hasGa4,
  hasHubSpot,
  onClose,
  onAdded,
}: {
  clientId: string;
  hasGa4: boolean;
  hasHubSpot: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [dataSource, setDataSource] = useState<"GA4" | "HUBSPOT">(
    hasGa4 ? "GA4" : "HUBSPOT"
  );
  const [category, setCategory] = useState(
    hasGa4 ? "Sessions & Traffic" : "contacts"
  );
  const [metricKey, setMetricKey] = useState("");
  const [hubspotDateField, setHubspotDateField] = useState("");
  const [hubspotFilterProperty, setHubspotFilterProperty] = useState("");
  const [hubspotFilterValue, setHubspotFilterValue] = useState("");
  const [label, setLabel] = useState("");
  const [thresholdLow, setThresholdLow] = useState("");
  const [thresholdHigh, setThresholdHigh] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hubspotProps, setHubspotProps] = useState<HubSpotPropertyFields | null>(null);
  const [hubspotPropsLoading, setHubspotPropsLoading] = useState(false);
  const [hubspotPropsError, setHubspotPropsError] = useState<string | null>(null);

  useEffect(() => {
    if (dataSource !== "HUBSPOT") {
      setHubspotProps(null);
      return;
    }
    setHubspotProps(null);
    setHubspotPropsError(null);
    setHubspotPropsLoading(true);
    getHubSpotPropertiesForMetric(clientId, category)
      .then(setHubspotProps)
      .catch((err) => setHubspotPropsError(err instanceof Error ? err.message : "Ophalen mislukt"))
      .finally(() => setHubspotPropsLoading(false));
  }, [clientId, dataSource, category]);

  const ga4Categories = Object.keys(GA4_METRIC_CATALOG) as Array<keyof typeof GA4_METRIC_CATALOG>;
  const metricsForObject = (dataSource === "HUBSPOT" ? HUBSPOT_METRICS[category] ?? [] : []) as Array<{
    key: string;
    label: string;
    needsDateField: boolean;
    needsFilterProperty?: boolean;
    filterLabel?: string;
    filterOptions?: Array<{ key: string; label: string }>;
  }>;
  const dateFieldsForObject = hubspotProps?.dateFields ?? [];
  const filterPropertiesForObject = hubspotProps?.filterProperties ?? [];
  const selectedFilterProperty = filterPropertiesForObject.find((p) => p.key === hubspotFilterProperty);

  const selectedMetric = metricsForObject.find((m) => m.key === metricKey);
  const needsDateField = selectedMetric?.needsDateField ?? false;
  const needsFilterProperty = selectedMetric?.needsFilterProperty ?? false;
  const hasFilterOptions =
    selectedMetric?.key === "count_by_lifecycle" &&
    (selectedMetric?.filterOptions?.length ?? 0) > 0;

  const canSubmit =
    dataSource === "GA4"
      ? !!metricKey
      : !!metricKey &&
        (!needsDateField || !!hubspotDateField) &&
        (!hasFilterOptions || !!hubspotFilterValue) &&
        (!needsFilterProperty || (!!hubspotFilterProperty && !!hubspotFilterValue && !!hubspotDateField));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await addMetricConfig(clientId, {
        label: label || (selectedMetric?.label as string) || metricKey,
        dataSource,
        metricKey,
        category,
        hubspotDateField: (needsDateField || needsFilterProperty) ? hubspotDateField || null : null,
        hubspotFilterProperty: needsFilterProperty ? hubspotFilterProperty || null : null,
        hubspotFilterValue: (hasFilterOptions || needsFilterProperty) ? hubspotFilterValue || null : null,
        thresholdLow: thresholdLow ? parseFloat(thresholdLow) : null,
        thresholdHigh: thresholdHigh ? parseFloat(thresholdHigh) : null,
        thresholdUnit: inferUnit(metricKey, dataSource),
      });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-metric-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-700/80 bg-zinc-900 p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h3 id="add-metric-title" className="text-lg font-medium text-white">
            Metric toevoegen
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {(hasGa4 && hasHubSpot) && (
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Source
              </label>
              <div className="mt-1 flex gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded border border-zinc-600 px-4 py-2">
                  <input
                    type="radio"
                    name="dataSource"
                    checked={dataSource === "GA4"}
                    onChange={() => {
                      setDataSource("GA4");
                      setCategory("Sessions & Traffic");
                      setMetricKey("");
                    }}
                    className="text-white"
                  />
                  <span className="text-sm text-zinc-200">GA4</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded border border-zinc-600 px-4 py-2">
                  <input
                    type="radio"
                    name="dataSource"
                    checked={dataSource === "HUBSPOT"}
                    onChange={() => {
                      setDataSource("HUBSPOT");
                      setCategory("contacts");
                      setMetricKey("");
                      setHubspotDateField("");
                      setHubspotFilterValue("");
                    }}
                    className="text-white"
                  />
                  <span className="text-sm text-zinc-200">HubSpot</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300">
              {dataSource === "GA4" ? "Category" : "Object"}
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setMetricKey("");
                setHubspotDateField("");
                setHubspotFilterProperty("");
                setHubspotFilterValue("");
              }}
              className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              {dataSource === "GA4"
                ? ga4Categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))
                : HUBSPOT_OBJECTS.map((obj) => (
                    <option key={obj.key} value={obj.key}>{obj.label}</option>
                  ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300">Metric</label>
            <div className="mt-1 space-y-1 rounded-lg border border-zinc-600 bg-zinc-800 p-2">
              {dataSource === "GA4"
                ? (GA4_METRIC_CATALOG[category as keyof typeof GA4_METRIC_CATALOG] ?? []).map((m) => (
                    <label
                      key={m.key}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-700"
                    >
                      <input
                        type="radio"
                        name="metricKey"
                        value={m.key}
                        checked={metricKey === m.key}
                        onChange={() => {
                          setMetricKey(m.key);
                          if (!label) setLabel(m.label);
                        }}
                        className="text-white"
                      />
                      <span className="text-sm text-zinc-200">{m.label}</span>
                    </label>
                  ))
                : metricsForObject.map((m) => (
                    <label
                      key={m.key}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-700"
                    >
                      <input
                        type="radio"
                        name="metricKey"
                        value={m.key}
                        checked={metricKey === m.key}
onChange={() => {
                        setMetricKey(m.key);
                        setHubspotDateField("");
                        setHubspotFilterProperty("");
                        setHubspotFilterValue("");
                        if (!label) setLabel(m.label);
                      }}
                        className="text-white"
                      />
                      <span className="text-sm text-zinc-200">{m.label}</span>
                    </label>
                  ))}
            </div>
          </div>

          {dataSource === "HUBSPOT" && hubspotPropsError && (
            <div className="rounded bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              {hubspotPropsError}
            </div>
          )}

          {dataSource === "HUBSPOT" && needsFilterProperty && (
            <>
              <p className="text-xs text-zinc-500">
                Alleen dropdown-velden (max 1 keuze) worden ondersteund.
              </p>
              {hubspotPropsLoading ? (
                <p className="text-sm text-zinc-500">Velden laden…</p>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-zinc-300">
                      Filter property
                    </label>
                    <select
                      value={hubspotFilterProperty}
                      onChange={(e) => {
                        setHubspotFilterProperty(e.target.value);
                        setHubspotFilterValue("");
                      }}
                      className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      <option value="">— Kies property —</option>
                      {filterPropertiesForObject.map((fp) => (
                        <option key={fp.key} value={fp.key}>{fp.label}</option>
                      ))}
                    </select>
                  </div>
                  {selectedFilterProperty && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-300">
                        Waarde ({selectedFilterProperty.label})
                      </label>
                      <select
                        value={hubspotFilterValue}
                        onChange={(e) => setHubspotFilterValue(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      >
                        <option value="">— Kies waarde —</option>
                        {selectedFilterProperty.values.map((v) => (
                          <option key={v.key} value={v.key}>{v.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-zinc-300">
                      Datumveld (30d venster)
                    </label>
                    <select
                      value={hubspotDateField}
                      onChange={(e) => setHubspotDateField(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      <option value="">— Kies datumveld —</option>
                      {dateFieldsForObject.map((df) => (
                        <option key={df.key} value={df.key}>{df.label}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-zinc-500">
                      Telt alleen records waarvan dit veld in de laatste 30 dagen valt
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {dataSource === "HUBSPOT" && needsDateField && !needsFilterProperty && (
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Datumveld
              </label>
              {hubspotPropsLoading ? (
                <p className="text-sm text-zinc-500">Velden laden…</p>
              ) : (
                <select
                  value={hubspotDateField}
                  onChange={(e) => setHubspotDateField(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="">— Kies datumveld —</option>
                  {dateFieldsForObject.map((df) => (
                    <option key={df.key} value={df.key}>{df.label}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {dataSource === "HUBSPOT" && hasFilterOptions && selectedMetric?.filterOptions && (
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                {selectedMetric?.filterLabel ?? "Filter"}
              </label>
              <select
                value={hubspotFilterValue}
                onChange={(e) => setHubspotFilterValue(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">— Kies stage —</option>
                {selectedMetric.filterOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-300">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={(selectedMetric?.label as string) ?? ""}
              className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="space-y-1 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
            <p className="text-xs text-zinc-500">
              GA4: thresholds zijn voor 30 dagen. HubSpot: voor totaal. LOW &lt; X (rood), NORMAL = blauw, HIGH &gt; X (groen).
            </p>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-zinc-300">
                  Low (alert when 30d value &lt;)
                </label>
                <input
                  type="number"
                  value={thresholdLow}
                  onChange={(e) => setThresholdLow(e.target.value)}
                  placeholder="—"
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300">
                  High (alert when 30d value &gt;)
                </label>
                <input
                  type="number"
                  value={thresholdHigh}
                  onChange={(e) => setThresholdHigh(e.target.value)}
                  placeholder="—"
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50"
            >
              {loading ? "Toevoegen…" : "Toevoegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
