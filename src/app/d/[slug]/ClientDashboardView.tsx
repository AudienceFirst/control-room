"use client";

import type { TaskSummary } from "@/types/snapshot";
import type { FunnelData } from "@/types/funnel";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ClientDashboardData = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  metricConfigs: Array<{
    id: string;
    label: string;
    dataSource: string;
    thresholdUnit: string | null;
    snapshots: Array<{ value: number; previousValue: number | null; alertStatus: string }>;
  }>;
  sentimentSnapshot: {
    overallScore: number;
    trend: string;
    emailsAnalyzed: number;
    hasEscalation: boolean;
    escalationSnippet: string | null;
  } | null;
};

type Props = {
  client: ClientDashboardData;
  tasks: TaskSummary | null;
  funnel: FunnelData | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value: number, unit: string | null) {
  if (unit === "percentage") return `${value.toFixed(1)}%`;
  if (unit === "currency") return `€${value.toLocaleString("nl-NL")}`;
  return value.toLocaleString("nl-NL");
}
function kpiColor(s?: string) {
  if (s === "LOW") return "text-red-400";
  if (s === "HIGH") return "text-emerald-400";
  return "text-white";
}
function sentimentColor(score: number) {
  if (score > 0.2) return "text-emerald-400";
  if (score >= -0.2) return "text-blue-400";
  return "text-red-400";
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function ClientDashboardView({ client, tasks, funnel }: Props) {
  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-10 lg:px-12">
      {/* Header */}
      <header className="mb-10 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {client.logoUrl && (
            <img src={client.logoUrl} alt="" className="h-12 w-auto object-contain opacity-90" />
          )}
          <h1 className="text-2xl font-semibold tracking-tight text-white">{client.name}</h1>
        </div>
      </header>

      <div className="space-y-8">
        {/* KPI strip */}
        {client.metricConfigs.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {client.metricConfigs.map((m) => {
              const snap = m.snapshots[0];
              return (
                <div key={m.id} className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
                  <p className="mb-2 text-xs font-medium text-zinc-500">{m.label}</p>
                  <p className={`font-mono text-2xl font-semibold tabular-nums ${kpiColor(snap?.alertStatus)}`}>
                    {snap ? fmt(snap.value, m.thresholdUnit) : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Funnel */}
        {funnel && funnel.steps.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-5 text-xs font-medium uppercase tracking-widest text-zinc-500">Funnel</h2>
            {funnel.campaignNames.length > 0 && (
              <p className="mb-4 text-xs text-zinc-600">Campagnes: {funnel.campaignNames.join(", ")}</p>
            )}
            <ol className="space-y-2">
              {funnel.steps.map((step) => (
                <li key={step.order} className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-4 py-3">
                  <span className="text-sm text-zinc-300">
                    <span className="mr-2 font-mono text-zinc-600">{step.order}.</span>
                    {step.label}
                  </span>
                  <span className="font-mono tabular-nums text-white">{step.value.toLocaleString("nl-NL")}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Sentiment + Tasks */}
        {(client.sentimentSnapshot || tasks) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {client.sentimentSnapshot && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="mb-4 text-xs font-medium uppercase tracking-widest text-zinc-500">E-mail sentiment</h2>
                <div className="flex items-baseline gap-3">
                  <span className={`font-mono text-3xl font-semibold tabular-nums ${sentimentColor(client.sentimentSnapshot.overallScore)}`}>
                    {client.sentimentSnapshot.overallScore.toFixed(2)}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {client.sentimentSnapshot.trend} · {client.sentimentSnapshot.emailsAnalyzed} e-mails
                  </span>
                </div>
                {client.sentimentSnapshot.hasEscalation && (
                  <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                    {client.sentimentSnapshot.escalationSnippet || "Escalatie gedetecteerd"}
                  </div>
                )}
              </div>
            )}
            {tasks && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="mb-4 text-xs font-medium uppercase tracking-widest text-zinc-500">Taken</h2>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="font-mono text-2xl font-semibold text-white">{tasks.incompleteCount}</p>
                    <p className="mt-1 text-xs text-zinc-500">open</p>
                  </div>
                  <div>
                    <p className={`font-mono text-2xl font-semibold ${tasks.overdueCount > 0 ? "text-red-400" : "text-white"}`}>
                      {tasks.overdueCount}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">verlopen</p>
                  </div>
                  <div>
                    <p className="font-mono text-2xl font-semibold text-emerald-400">{tasks.recentlyCompletedCount}</p>
                    <p className="mt-1 text-xs text-zinc-500">afgerond (7d)</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="mt-16 border-t border-zinc-900 pt-6 text-center text-xs text-zinc-700">
        Powered by ZUID
      </footer>
    </div>
  );
}
