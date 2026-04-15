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

/** Mini sparkline from snapshot values (newest first), with time-proportional x-axis and threshold lines */
function MetricTrend({
  values,
  dates,
  previousValue,
  alertStatus,
  thresholdLow,
  thresholdHigh,
}: {
  values: number[];
  dates?: (Date | string)[];
  previousValue?: number | null;
  alertStatus?: string;
  thresholdLow?: number | null;
  thresholdHigh?: number | null;
}) {
  const strokeColor =
    alertStatus === "LOW"
      ? "#f87171"
      : alertStatus === "HIGH"
        ? "#34d399"
        : "#71717a";

  if (values.length >= 2) {
    // Oldest → newest
    const v = [...values].reverse();
    const ts = dates ? [...dates].reverse().map((d) => new Date(d).getTime()) : null;

    const hasThresholds = thresholdLow != null || thresholdHigh != null;
    const allVals = [
      ...v,
      ...(thresholdLow != null ? [thresholdLow] : []),
      ...(thresholdHigh != null ? [thresholdHigh] : []),
    ];
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    // Add 10% padding above/below so threshold lines aren't clipped to the edge
    const rawRange = maxV - minV || 1;
    const pad10 = rawRange * 0.12;
    const domainMin = minV - pad10;
    const domainMax = maxV + pad10;
    const domainRange = domainMax - domainMin;

    const W = hasThresholds ? 56 : 44;
    const H = hasThresholds ? 22 : 16;
    const padPx = 1;

    const toY = (val: number) =>
      H - padPx - ((val - domainMin) / domainRange) * (H - padPx * 2);

    const toX = (i: number): number => {
      if (ts && ts.length >= 2) {
        const t0 = ts[0];
        const t1 = ts[ts.length - 1];
        const timeRange = t1 - t0 || 1;
        return ((ts[i] - t0) / timeRange) * W;
      }
      return (i / (v.length - 1)) * W;
    };

    const points = v
      .map((val, i) => `${toX(i).toFixed(1)},${toY(val).toFixed(1)}`)
      .join(" ");

    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
        {/* Threshold band */}
        {thresholdLow != null && thresholdHigh != null && (
          <rect
            x={0} y={toY(thresholdHigh)}
            width={W}
            height={Math.abs(toY(thresholdLow) - toY(thresholdHigh))}
            fill="#71717a" opacity="0.06"
          />
        )}
        {/* Threshold lines */}
        {thresholdLow != null && (
          <line
            x1={0} y1={toY(thresholdLow).toFixed(1)}
            x2={W} y2={toY(thresholdLow).toFixed(1)}
            stroke="#71717a" strokeWidth="1.2" strokeDasharray="3,2"
          />
        )}
        {thresholdHigh != null && (
          <line
            x1={0} y1={toY(thresholdHigh).toFixed(1)}
            x2={W} y2={toY(thresholdHigh).toFixed(1)}
            stroke="#71717a" strokeWidth="1.2" strokeDasharray="3,2"
          />
        )}
        {/* Value line */}
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  }

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
    thresholdLow: number | null;
    thresholdHigh: number | null;
    snapshots: Array<{
      value: number;
      previousValue?: number | null;
      alertStatus: string;
      capturedAt: Date;
    }>;
  }>;
}

/** Hoeveel dagen is de metric al in de huidige (HIGH/LOW) status? */
function alertDaysOld(snapshots: Array<{ alertStatus: string; capturedAt: Date | string }>): number {
  if (snapshots.length === 0) return 1;
  const status = snapshots[0].alertStatus;
  let i = 0;
  while (i < snapshots.length && snapshots[i].alertStatus === status) i++;
  const oldest = snapshots[i - 1];
  if (!oldest) return 1;
  const ms = Date.now() - new Date(oldest.capturedAt).getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)));
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
        <div className="mt-4 border-t border-zinc-700/40 pt-4">
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
            Metrics
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3">
            {metrics.map((m) => {
              const snap = m.snapshots[0];
              const isAlert = snap?.alertStatus === "LOW" || snap?.alertStatus === "HIGH";
              const daysOld = isAlert ? alertDaysOld(m.snapshots) : null;
              const isHubSpot30d =
                m.dataSource === "HUBSPOT" &&
                (m.metricKey?.startsWith("count_created:") ||
                  m.metricKey?.startsWith("count_modified:") ||
                  m.metricKey?.startsWith("count_filtered:"));
              const windowLabel =
                m.dataSource === "GA4" ? "30d" : isHubSpot30d ? "30d" : "totaal";
              const trendValues = m.snapshots.map((s) => s.value);
              const trendDates = m.snapshots.map((s) => s.capturedAt);

              const dotColor =
                snap?.alertStatus === "LOW"
                  ? "bg-red-500"
                  : snap?.alertStatus === "HIGH"
                    ? "bg-emerald-500"
                    : "bg-zinc-600";

              const bgColor =
                snap?.alertStatus === "LOW"
                  ? "bg-red-500/5 border-red-500/15"
                  : snap?.alertStatus === "HIGH"
                    ? "bg-emerald-500/5 border-emerald-500/15"
                    : "bg-zinc-800/30 border-zinc-700/30";

              return (
                <div
                  key={m.id}
                  className={`rounded-lg border p-2.5 ${bgColor}`}
                >
                  {/* Top row: dot + value + badge + sparkline */}
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotColor} ${isAlert ? "shadow-[0_0_5px_currentColor]" : ""}`} />
                      <span className={`text-xl font-bold tabular-nums leading-none ${metricValueColor(snap?.alertStatus)}`}>
                        {snap ? formatMetricValue(snap.value, m.thresholdUnit) : "—"}
                      </span>
                      {daysOld !== null && (
                        <span
                          className={`shrink-0 self-end mb-0.5 rounded px-1 py-px text-[10px] font-medium tabular-nums ${
                            snap?.alertStatus === "LOW"
                              ? "bg-red-500/20 text-red-400"
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}
                          title={`${daysOld} dag${daysOld !== 1 ? "en" : ""} buiten parameters`}
                        >
                          {daysOld}d
                        </span>
                      )}
                    </div>
                    <MetricTrend
                      values={trendValues}
                      dates={trendDates}
                      previousValue={snap?.previousValue}
                      alertStatus={snap?.alertStatus}
                      thresholdLow={m.thresholdLow}
                      thresholdHigh={m.thresholdHigh}
                    />
                  </div>
                  {/* Label row */}
                  <div className="mt-1.5 flex items-center gap-1 pl-3.5">
                    <span className="truncate text-xs text-zinc-400">{m.label}</span>
                    <span className="shrink-0 text-[10px] text-zinc-600">· {windowLabel}</span>
                  </div>
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
