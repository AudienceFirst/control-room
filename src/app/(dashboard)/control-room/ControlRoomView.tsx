"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { refreshAllClientsData } from "@/app/actions/control-room";
import { ClientCard } from "./ClientCard";
import { ClientListItem } from "./ClientListItem";
import { ClientCardErrorBoundary } from "./ClientCardErrorBoundary";
import type { TaskSummary } from "@/types/snapshot";

const VIEW_KEY = "control-room-view";

export type ClientForView = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  clientLead: string | null;
  clickupConfig: { clientFolderId: string } | null;
  hubspotConnection: { portalId: string; hubDomain: string | null; isValid: boolean } | null;
  ga4Config: { ga4PropertyId: string } | null;
  gmailConnection: { id: string; isValid: boolean } | null;
  sentimentSnapshot: {
    overallScore: number;
    trend: string;
    emailsAnalyzed: number;
    lastEmailAt: Date | null;
    hasEscalation: boolean;
    escalationSnippet: string | null;
  } | null;
  metricConfigs: Array<{
    id: string;
    label: string;
    dataSource: string;
    metricKey?: string;
    category: string;
    thresholdUnit: string | null;
    snapshots: Array<{
      value: number;
      previousValue: number | null;
      alertStatus: string;
      capturedAt: Date;
    }>;
  }>;
};

type ControlRoomViewProps = {
  clients: ClientForView[];
  tasksByClient: Array<{ tasks: TaskSummary | null; error: string | null }>;
  clickupWorkspaceId: string | null;
  hubspotRegion: string;
};

const FILTER_LEAD_KEY = "control-room-filter-lead";
const SORT_KEY = "control-room-sort";

type SortMode = "name" | "attention";

function clientUrgencyScore(
  client: ClientForView,
  tasks: { tasks: TaskSummary | null; error: string | null } | undefined,
): number {
  let score = 0;
  const overdue = tasks?.tasks?.overdueCount ?? 0;
  if (overdue > 0) score += 10 + overdue;
  if (client.sentimentSnapshot?.hasEscalation) score += 15;
  if (client.sentimentSnapshot && client.sentimentSnapshot.overallScore < -0.2) score += 8;
  for (const m of client.metricConfigs) {
    const snap = m.snapshots[0];
    if (snap?.alertStatus === "LOW") score += 5;
    if (snap?.alertStatus === "HIGH") score += 2;
  }
  return score;
}

export function ControlRoomView({
  clients,
  tasksByClient,
  clickupWorkspaceId,
  hubspotRegion,
}: ControlRoomViewProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [refreshing, setRefreshing] = useState(false);
  const [leadFilter, setLeadFilter] = useState<string>("");
  const [sortMode, setSortMode] = useState<SortMode>("name");

  const uniqueLeads = [...new Set(clients.map((c) => c.clientLead).filter(Boolean))] as string[];
  uniqueLeads.sort();
  const filteredByLead = leadFilter
    ? clients.filter((c) => c.clientLead === leadFilter)
    : clients;

  const filteredClients = sortMode === "attention"
    ? [...filteredByLead].sort((a, b) => {
        const ai = clients.indexOf(a);
        const bi = clients.indexOf(b);
        return clientUrgencyScore(b, tasksByClient[bi]) - clientUrgencyScore(a, tasksByClient[ai]);
      })
    : filteredByLead;

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_KEY) as "cards" | "list" | null;
    if (stored === "cards" || stored === "list") setViewMode(stored);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(FILTER_LEAD_KEY);
    if (stored && (stored === "" || uniqueLeads.includes(stored))) setLeadFilter(stored);
  }, [uniqueLeads.join(",")]);

  useEffect(() => {
    const stored = localStorage.getItem(SORT_KEY) as SortMode | null;
    if (stored === "name" || stored === "attention") setSortMode(stored);
  }, []);

  function handleViewChange(mode: "cards" | "list") {
    setViewMode(mode);
    localStorage.setItem(VIEW_KEY, mode);
  }

  function handleLeadFilterChange(lead: string) {
    setLeadFilter(lead);
    localStorage.setItem(FILTER_LEAD_KEY, lead);
  }

  function handleSortChange(mode: SortMode) {
    setSortMode(mode);
    localStorage.setItem(SORT_KEY, mode);
  }

  async function handleRefreshAll() {
    setRefreshing(true);
    try {
      const result = await refreshAllClientsData();
      if (result.success) router.refresh();
      else alert(result.error);
    } catch {
      alert("Vernieuwen mislukt");
    } finally {
      setRefreshing(false);
    }
  }

  // Aggregate stats
  const totalClients = filteredClients.length;
  const alertCount = filteredClients.reduce((sum, c) => {
    const ci = clients.indexOf(c);
    const metricAlerts = c.metricConfigs.filter((m) => {
      const s = m.snapshots[0];
      return s?.alertStatus === "LOW" || s?.alertStatus === "HIGH";
    }).length;
    const overdueCount = tasksByClient[ci]?.tasks?.overdueCount ?? 0;
    return sum + metricAlerts + (overdueCount > 0 ? 1 : 0);
  }, 0);
  const totalOverdue = filteredClients.reduce((sum, c) => {
    const ci = clients.indexOf(c);
    return sum + (tasksByClient[ci]?.tasks?.overdueCount ?? 0);
  }, 0);
  const escalationCount = filteredClients.filter(
    (c) => c.sentimentSnapshot?.hasEscalation
  ).length;

  return (
    <>
      <header className="relative z-10 mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8 sm:gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl lg:text-3xl">
              Control Room
            </h1>
            <span
              className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400"
              aria-hidden
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              LIVE
            </span>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          <select
            value={sortMode}
            onChange={(e) => handleSortChange(e.target.value as SortMode)}
            className="rounded-lg border border-zinc-600 bg-zinc-800/60 px-2.5 py-2 text-xs text-zinc-300 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:px-3 sm:text-sm"
            aria-label="Sortering"
          >
            <option value="name">A → Z</option>
            <option value="attention">Aandacht eerst</option>
          </select>
          {uniqueLeads.length > 0 && (
            <select
              value={leadFilter}
              onChange={(e) => handleLeadFilterChange(e.target.value)}
              className="rounded-lg border border-zinc-600 bg-zinc-800/60 px-2.5 py-2 text-xs text-zinc-300 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 sm:px-3 sm:text-sm"
              aria-label="Filter op lead"
            >
              <option value="">Alle leads</option>
              {uniqueLeads.map((lead) => (
                <option key={lead} value={lead}>
                  {lead}
                </option>
              ))}
            </select>
          )}
          <div
            className="flex rounded-lg border border-zinc-600 bg-zinc-800/60 p-0.5"
            role="tablist"
            aria-label="Weergave"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "cards"}
              onClick={() => handleViewChange("cards")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                viewMode === "cards"
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-300"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="hidden sm:inline">Kaarten</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "list"}
              onClick={() => handleViewChange("list")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                viewMode === "list"
                  ? "bg-zinc-700 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-300"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">Lijst</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/60 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-emerald-500/40 hover:bg-zinc-700/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50 sm:px-4 sm:py-2.5 sm:text-sm"
            title="Vernieuw alle clients"
          >
            <span className={`text-lg ${refreshing ? "animate-spin-smooth" : ""}`}>↻</span>
            <span className="hidden sm:inline">{refreshing ? "Vernieuwen…" : "Vernieuw alles"}</span>
          </button>
        </div>
      </header>

      {/* Summary stats */}
      <div className="relative z-10 mb-4 flex flex-wrap items-center gap-2 sm:mb-6 sm:gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-1.5">
          <span className="text-sm font-medium tabular-nums text-white">{totalClients}</span>
          <span className="text-xs text-zinc-500">clients</span>
        </div>
        {alertCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-sm font-medium tabular-nums text-amber-400">{alertCount}</span>
            <span className="text-xs text-zinc-500">{alertCount === 1 ? "alert" : "alerts"}</span>
          </div>
        )}
        {totalOverdue > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            <span className="text-sm font-medium tabular-nums text-red-400">{totalOverdue}</span>
            <span className="text-xs text-zinc-500">overdue</span>
          </div>
        )}
        {escalationCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5">
            <svg className="h-3.5 w-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium tabular-nums text-red-400">{escalationCount}</span>
            <span className="text-xs text-zinc-500">{escalationCount === 1 ? "escalatie" : "escalaties"}</span>
          </div>
        )}
        {alertCount === 0 && totalOverdue === 0 && escalationCount === 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-emerald-400">Alles op koers</span>
          </div>
        )}
      </div>

      <div className="relative z-10">
        {viewMode === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
            {filteredClients.map((client) => {
              const i = clients.indexOf(client);
              return (
                <ClientCardErrorBoundary key={client.id} clientName={client.name}>
                  <ClientCard
                    client={client}
                    tasks={tasksByClient[i]?.tasks ?? null}
                    tasksError={tasksByClient[i]?.error ?? null}
                    metrics={client.metricConfigs}
                    sentiment={client.sentimentSnapshot}
                    clickupWorkspaceId={clickupWorkspaceId}
                    hubspotRegion={hubspotRegion}
                  />
                </ClientCardErrorBoundary>
              );
            })}
            <a
              href="/settings/clients/new"
              className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-600 bg-zinc-900/30 p-6 text-zinc-500 transition-all duration-300 hover:border-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
              aria-label="Client toevoegen"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-current">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </span>
              <span className="text-sm font-medium">Client toevoegen</span>
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-visible rounded-xl border border-zinc-700/80 bg-zinc-900/50">
            <table className="min-w-[640px] w-full">
              <thead>
                <tr className="border-b border-zinc-700/80 bg-zinc-800/30">
                  <th className="py-3 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Client
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Sentiment
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Taken
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Integraties
                  </th>
                  <th className="w-12 py-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const i = clients.indexOf(client);
                  return (
                    <ClientListItem
                      key={client.id}
                      client={client}
                      tasks={tasksByClient[i]?.tasks ?? null}
                      sentiment={client.sentimentSnapshot}
                      clickupWorkspaceId={clickupWorkspaceId}
                      hubspotRegion={hubspotRegion}
                    />
                  );
                })}
              </tbody>
            </table>
            <a
              href="/settings/clients/new"
              className="flex items-center justify-center gap-2 border-t border-zinc-700/80 py-4 text-sm text-zinc-500 transition-colors hover:bg-zinc-800/40 hover:text-zinc-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Client toevoegen
            </a>
          </div>
        )}
      </div>
    </>
  );
}
