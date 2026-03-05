"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClickUpIcon, HubSpotIcon, GA4Icon, GmailIcon } from "@/components/IntegrationIcons";
import { refreshClientData } from "@/app/actions/control-room";
import type { TaskSummary } from "@/types/snapshot";

function formatMetricValue(value: number, unit: string | null): string {
  if (unit === "percentage") return `${value.toFixed(1)}%`;
  if (unit === "currency") return `€${value.toLocaleString("nl-NL")}`;
  return value.toLocaleString("nl-NL");
}

/** Mini sparkline from snapshot values (newest first), or trend arrow from previousValue */
function MetricTrend({
  values,
  previousValue,
  alertStatus,
}: {
  values: number[];
  previousValue?: number | null;
  alertStatus?: string;
}) {
  const strokeColor =
    alertStatus === "LOW"
      ? "text-red-400"
      : alertStatus === "HIGH"
        ? "text-emerald-400"
        : "text-zinc-400";
  // Sparkline: 2+ snapshots
  if (values.length >= 2) {
    const v = [...values].reverse();
    const min = Math.min(...v);
    const max = Math.max(...v);
    const range = max - min || 1;
    const w = 28;
    const h = 12;
    const points = v
      .map((val, i) => {
        const x = (i / (v.length - 1)) * w;
        const y = h - ((val - min) / range) * h;
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <svg width={w} height={h} className="shrink-0 opacity-80" viewBox={`0 0 ${w} ${h}`}>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          className={strokeColor}
        />
      </svg>
    );
  }
  // Trend arrow: 1 snapshot met previousValue
  if (values.length === 1 && previousValue != null) {
    const current = values[0];
    const trend = current > previousValue ? "up" : current < previousValue ? "down" : "flat";
    const arrows = { up: "↗", down: "↘", flat: "→" };
    const colors = { up: "text-emerald-500", down: "text-red-400", flat: "text-zinc-500" };
    return (
      <span className={`shrink-0 text-xs ${colors[trend]}`} title="Trend vs vorige waarde">
        {arrows[trend]}
      </span>
    );
  }
  // Geen data: subtiel streepje
  return (
    <span className="shrink-0 w-5 h-px bg-zinc-600/50 rounded" title="Refresh voor trend" />
  );
}

interface ClientCardProps {
  client: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    clientLead: string | null;
    clickupConfig: { clientFolderId: string } | null;
    hubspotConnection: { portalId: string; hubDomain: string | null; isValid?: boolean } | null;
    ga4Config: { ga4PropertyId: string } | null;
    gmailConnection: { id: string; isValid?: boolean } | null;
  };
  clickupWorkspaceId?: string | null;
  hubspotRegion?: string;
  tasks: TaskSummary | null;
  tasksError?: string | null;
  sentiment?: {
    overallScore: number;
    trend: string;
    emailsAnalyzed: number;
    lastEmailAt: Date | null;
    hasEscalation: boolean;
    escalationSnippet: string | null;
  } | null;
  metrics?: Array<{
    id: string;
    label: string;
    dataSource: string;
    metricKey?: string;
    thresholdUnit: string | null;
    snapshots: Array<{
      value: number;
      previousValue?: number | null;
      alertStatus: string;
    }>;
  }>;
}

/** Metric value color: same as sentiment (green=high, blue=normal, red=low) */
function metricValueColor(alertStatus: string | undefined) {
  if (alertStatus === "LOW") return "text-red-500";
  if (alertStatus === "HIGH") return "text-emerald-500";
  if (alertStatus === "NORMAL") return "text-blue-500";
  return "text-zinc-400";
}

/** Sentiment color: green (positive), blue (neutral), red (negative) */
function sentimentColor(score: number) {
  if (score > 0.2) return "text-emerald-500";
  if (score >= -0.2) return "text-blue-500";
  return "text-red-500";
}

function sentimentDot(score: number) {
  if (score > 0.2) return "bg-emerald-500";
  if (score >= -0.2) return "bg-blue-500";
  return "bg-red-500";
}

function overallHealthBorder(
  metrics: ClientCardProps["metrics"],
  sentiment: ClientCardProps["sentiment"],
  tasks: ClientCardProps["tasks"],
): string {
  const hasLow = metrics?.some((m) => m.snapshots[0]?.alertStatus === "LOW");
  const hasOverdue = (tasks?.overdueCount ?? 0) > 0;
  const hasEscalation = sentiment?.hasEscalation;
  const negSentiment = sentiment && sentiment.overallScore < -0.2;

  if (hasLow || hasOverdue || hasEscalation || negSentiment) return "border-l-red-500/60";
  const hasHigh = metrics?.some((m) => m.snapshots[0]?.alertStatus === "HIGH");
  const posSentiment = sentiment && sentiment.overallScore > 0.2;
  if (hasHigh || posSentiment) return "border-l-emerald-500/60";
  return "border-l-transparent";
}

export function ClientCard({
  client,
  tasks,
  tasksError,
  metrics = [],
  sentiment,
  clickupWorkspaceId,
  hubspotRegion = "us",
}: ClientCardProps) {
  const router = useRouter();
  const [openExpanded, setOpenExpanded] = useState(false);
  const [doneExpanded, setDoneExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const healthBorder = overallHealthBorder(metrics, sentiment, tasks);

  async function handleRefreshAll(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRefreshing(true);
    try {
      const result = await refreshClientData(client.id);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error(err);
      alert("Vernieuwen mislukt");
    } finally {
      setRefreshing(false);
    }
  }

  const clickupUrl =
    client.clickupConfig && clickupWorkspaceId
      ? `https://app.clickup.com/${clickupWorkspaceId}/v/f/${client.clickupConfig.clientFolderId}`
      : null;
  const hubspotUrl = client.hubspotConnection
    ? hubspotRegion === "eu"
      ? `https://app-eu1.hubspot.com/contacts/${client.hubspotConnection.portalId}`
      : `https://app.hubspot.com/contacts/${client.hubspotConnection.portalId}`
    : null;
  const ga4Url = client.ga4Config
    ? `https://analytics.google.com/analytics/web/#/p${client.ga4Config.ga4PropertyId}`
    : null;
  const gmailUrl = client.gmailConnection
    ? `/settings/clients/${client.id}?tab=sentiment`
    : null;

  const handleBadgeClick = (
    e: React.MouseEvent,
    expandKey: "open" | "done"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (expandKey === "open") setOpenExpanded((v) => !v);
    else setDoneExpanded((v) => !v);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/settings/clients/${client.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/settings/clients/${client.id}`);
        }
      }}
      className={`group block cursor-pointer rounded-xl border border-l-2 border-zinc-700/80 ${healthBorder} bg-zinc-900/50 p-6 shadow-lg shadow-black/20 transition-all duration-300 hover:border-zinc-600 hover:bg-zinc-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2`}
      aria-label={`${client.name} — bekijk instellingen`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white">{client.name}</h3>
          {client.clientLead && (
            <span className="mt-1.5 inline-block rounded-full bg-zinc-700/80 px-2.5 py-0.5 text-xs text-zinc-400">
              {client.clientLead}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefreshAll}
          disabled={refreshing}
          className="shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-1 disabled:opacity-50"
          title="Vernieuw metrics, sentiment en ClickUp"
          aria-label="Vernieuw data"
        >
          <span className={`inline-block text-lg ${refreshing ? "animate-spin-smooth" : ""}`}>↻</span>
        </button>
      </div>

      {(client.hubspotConnection?.isValid === false || client.gmailConnection?.isValid === false) && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-xs text-amber-400">
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>
            {[
              client.hubspotConnection?.isValid === false && "HubSpot",
              client.gmailConnection?.isValid === false && "Gmail",
            ].filter(Boolean).join(" & ")}{" "}
            verbinding verlopen — herverbind in Settings
          </span>
        </div>
      )}

      {metrics.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-zinc-700/40 pt-4">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Metrics
          </div>
          <div className="space-y-1.5">
            {metrics.map((m) => {
              const snap = m.snapshots[0];
              const dotColor =
                snap?.alertStatus === "LOW"
                  ? "bg-red-500"
                  : snap?.alertStatus === "HIGH"
                    ? "bg-emerald-500"
                    : snap?.alertStatus === "NORMAL"
                      ? "bg-blue-500"
                      : "bg-zinc-500";
              const isHubSpot30d =
                m.dataSource === "HUBSPOT" &&
                (m.metricKey?.startsWith("count_created:") ||
                  m.metricKey?.startsWith("count_modified:") ||
                  m.metricKey?.startsWith("count_filtered:"));
              const windowLabel =
                m.dataSource === "GA4"
                  ? "30d"
                  : isHubSpot30d
                    ? "30d"
                    : "total";
              const trendValues = m.snapshots.map((s) => s.value);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor} ${snap?.alertStatus === "LOW" || snap?.alertStatus === "HIGH" ? "shadow-[0_0_6px_currentColor]" : ""}`} />
                  <span className="min-w-0 flex-1 text-white">
                    <span className={`font-mono tabular-nums ${metricValueColor(snap?.alertStatus)}`}>{snap ? formatMetricValue(snap.value, m.thresholdUnit) : "—"}</span>
                    <span className="ml-1">· {m.label}</span>
                    <span className="ml-1 text-zinc-500">({windowLabel})</span>
                  </span>
                  <MetricTrend
                    values={trendValues}
                    previousValue={snap?.previousValue}
                    alertStatus={snap?.alertStatus}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {sentiment && (
        <div className="mt-4 space-y-1.5 border-t border-zinc-700/40 pt-4">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Sentiment
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sentimentDot(sentiment.overallScore)}`} />
            <span className={`font-mono tabular-nums ${sentimentColor(sentiment.overallScore)}`}>
              {sentiment.overallScore.toFixed(2)}
            </span>
            <span className="text-white">
              · {sentiment.emailsAnalyzed} e-mails
            </span>
            <span className="text-zinc-500">({sentiment.trend})</span>
          </div>
          {sentiment.hasEscalation && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Escalatie gedetecteerd
            </div>
          )}
        </div>
      )}

      {tasks && (
        <div className="mt-4 space-y-2 border-t border-zinc-700/40 pt-4">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Tasks
          </div>
          <div className="flex flex-wrap gap-2">
            {tasks.overdueCount > 0 && (
              <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                {tasks.overdueCount} overdue
              </span>
            )}
            <button
              type="button"
              onClick={(e) => handleBadgeClick(e, "open")}
              className="rounded-md bg-zinc-700/80 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-1"
            >
              {tasks.incompleteCount} open {openExpanded ? "▼" : "▶"}
            </button>
            <button
              type="button"
              onClick={(e) => handleBadgeClick(e, "done")}
              className="rounded-md bg-zinc-700/80 px-2.5 py-1 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-1"
            >
              {tasks.recentlyCompletedCount} done (7d) {doneExpanded ? "▼" : "▶"}
            </button>
          </div>

          {openExpanded && (
            <div className="max-h-80 overflow-y-auto rounded border border-zinc-700 bg-zinc-900/50 p-2">
              <p className="text-xs font-medium text-zinc-400">Open taken</p>
              {tasks.topIncompleteTasks.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">Geen open taken</p>
              ) : (
              <ul className="mt-1 space-y-1">
                {tasks.topIncompleteTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        task.isOverdue ? "bg-red-500" : "bg-zinc-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-300">
                        {task.name}
                      </span>
                      <span className="text-zinc-500">
                        {task.listName}
                        {task.isOverdue ? " · overdue" : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              )}
            </div>
          )}

          {doneExpanded && (
            <div className="max-h-80 overflow-y-auto rounded border border-zinc-700 bg-zinc-900/50 p-2">
              <p className="text-xs font-medium text-zinc-400">Done (7d)</p>
              {tasks.recentlyCompletedTasks.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-500">Geen taken afgerond</p>
              ) : (
              <ul className="mt-1 space-y-1">
                {tasks.recentlyCompletedTasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-400">
                        {task.name}
                      </span>
                      <span className="text-zinc-500">{task.listName}</span>
                    </div>
                  </li>
                ))}
              </ul>
              )}
            </div>
          )}

          {tasks.estimatesByStatus.length > 0 && (
            <p className="text-xs text-zinc-500">
              Estimates:{" "}
              {tasks.estimatesByStatus
                .map((s) => `${s.status} (${s.count})`)
                .join(", ")}
            </p>
          )}
          {tasks.projectsByStatus.length > 0 && (
            <p className="text-xs text-zinc-500">
              Projects:{" "}
              {tasks.projectsByStatus
                .map((s) => `${s.status} (${s.count})`)
                .join(", ")}
            </p>
          )}
        </div>
      )}

      {!tasks && (
        <div className="mt-4 border-t border-zinc-700/40 pt-4">
          <p className="text-xs text-zinc-500">
            {client.clickupConfig ? (
              tasksError ? (
                <>
                  Could not load tasks: <span className="text-amber-400">{tasksError}</span>
                </>
              ) : (
                "Could not load tasks — check folder ID in Settings"
              )
            ) : (
              "Configure ClickUp in Settings to see tasks"
            )}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-1 border-t border-zinc-700/40 pt-4" onClick={(e) => e.stopPropagation()} role="group" aria-label="Integraties">
        <a
          href={`/d/${client.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-1"
          title="Open client dashboard"
          aria-label="Open client dashboard"
        >
          <span aria-hidden>⊞</span> Dashboard
        </a>
        <a
          href={clickupUrl ?? "#"}
          target={clickupUrl ? "_blank" : undefined}
          rel={clickupUrl ? "noopener noreferrer" : undefined}
          onClick={(e) => !clickupUrl && e.preventDefault()}
          className="flex p-1 items-center justify-center rounded transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-1"
          title={client.clickupConfig ? "Open ClickUp folder" : "ClickUp niet verbonden"}
          aria-label={client.clickupConfig ? "ClickUp — open folder" : "ClickUp niet verbonden"}
        >
          <ClickUpIcon className="h-3 w-3" active={!!client.clickupConfig} />
        </a>
        <a
          href={hubspotUrl ?? "#"}
          target={hubspotUrl ? "_blank" : undefined}
          rel={hubspotUrl ? "noopener noreferrer" : undefined}
          onClick={(e) => !hubspotUrl && e.preventDefault()}
          className="flex p-1 items-center justify-center rounded transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-1"
          title={client.hubspotConnection ? "Open HubSpot portaal" : "HubSpot niet verbonden"}
          aria-label={client.hubspotConnection ? "HubSpot — open portaal" : "HubSpot niet verbonden"}
        >
          <HubSpotIcon className="h-3 w-3" active={!!client.hubspotConnection} />
        </a>
        <a
          href={ga4Url ?? "#"}
          target={ga4Url ? "_blank" : undefined}
          rel={ga4Url ? "noopener noreferrer" : undefined}
          onClick={(e) => !ga4Url && e.preventDefault()}
          className="flex p-1 items-center justify-center rounded transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-1"
          title={client.ga4Config ? "Open Google Analytics" : "GA4 niet verbonden"}
          aria-label={client.ga4Config ? "GA4 — open Analytics" : "GA4 niet verbonden"}
        >
          <GA4Icon className="h-3 w-3" active={!!client.ga4Config} />
        </a>
        <a
          href={gmailUrl ?? "#"}
          onClick={(e) => !gmailUrl && e.preventDefault()}
          className="flex p-1 items-center justify-center rounded transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-1"
          title={client.gmailConnection ? "Gmail sentiment — open instellingen" : "Gmail niet verbonden"}
          aria-label={client.gmailConnection ? "Gmail — sentiment" : "Gmail niet verbonden"}
        >
          <GmailIcon className="h-3 w-3" active={!!client.gmailConnection} />
        </a>
      </div>
    </article>
  );
}
