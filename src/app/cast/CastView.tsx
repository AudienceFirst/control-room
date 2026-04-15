"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

type Snapshot = {
  value: number;
  previousValue: number | null;
  alertStatus: string;
  capturedAt: Date;
};

type MetricConfig = {
  id: string;
  label: string;
  dataSource: string;
  metricKey: string;
  thresholdUnit: string | null;
  snapshots: Snapshot[];
};

type SentimentSnapshot = {
  overallScore: number;
  trend: string;
  hasEscalation: boolean;
  emailsAnalyzed: number;
} | null;

type Client = {
  id: string;
  name: string;
  logoUrl: string | null;
  sentimentSnapshot: SentimentSnapshot;
  metricConfigs: MetricConfig[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ROTATE_MS = 15_000;
const FADE_MS = 400;
const DATA_REFRESH_MS = 5 * 60_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatValue(value: number, unit: string | null): string {
  if (unit === "percentage") return `${value.toFixed(1)}%`;
  if (unit === "currency") return `€${value.toLocaleString("nl-NL")}`;
  return value.toLocaleString("nl-NL");
}

function clientOverallStatus(configs: MetricConfig[]): "LOW" | "HIGH" | "NORMAL" | "NONE" {
  const statuses = configs.map((m) => m.snapshots[0]?.alertStatus).filter(Boolean);
  if (statuses.includes("LOW")) return "LOW";
  if (statuses.includes("HIGH")) return "HIGH";
  if (statuses.includes("NORMAL")) return "NORMAL";
  return "NONE";
}

function valueSize(count: number): string {
  if (count <= 3) return "text-5xl";
  if (count <= 5) return "text-4xl";
  return "text-3xl";
}

/** Hoeveel dagen is de metric al in de huidige status? */
function alertDaysOld(snapshots: Snapshot[]): number {
  if (snapshots.length === 0) return 1;
  const status = snapshots[0].alertStatus;
  let i = 0;
  while (i < snapshots.length && snapshots[i].alertStatus === status) i++;
  const oldest = snapshots[i - 1];
  if (!oldest) return 1;
  const ms = Date.now() - new Date(oldest.capturedAt).getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

/** Maximale streak-leeftijd (in dagen) over een groep metrics met dezelfde status. */
function maxDaysForStatus(configs: MetricConfig[], status: "HIGH" | "LOW"): number {
  return configs
    .filter((m) => m.snapshots[0]?.alertStatus === status)
    .reduce((max, m) => Math.max(max, alertDaysOld(m.snapshots)), 0);
}

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({
  values,
  previousValue,
  alertStatus,
}: {
  values: number[];
  previousValue?: number | null;
  alertStatus?: string;
}) {
  const color =
    alertStatus === "LOW"
      ? "#f87171"
      : alertStatus === "HIGH"
        ? "#34d399"
        : "#71717a";

  if (values.length >= 2) {
    const v = [...values].reverse();
    const min = Math.min(...v);
    const max = Math.max(...v);
    const range = max - min || 1;
    const W = 72;
    const H = 24;
    const points = v
      .map((val, i) => {
        const x = (i / (v.length - 1)) * W;
        const y = H - ((val - min) / range) * (H - 4) - 2;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0 opacity-90">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  }

  if (values.length === 1 && previousValue != null) {
    const v = values[0];
    const arrow = v > previousValue ? "↗" : v < previousValue ? "↘" : "→";
    const c =
      v > previousValue ? "text-emerald-400" : v < previousValue ? "text-red-400" : "text-zinc-500";
    return <span className={`shrink-0 text-2xl font-light ${c}`}>{arrow}</span>;
  }

  return <span className="shrink-0 w-[72px] h-px bg-zinc-700/40 rounded self-center" />;
}

// ─── ClientPanel ─────────────────────────────────────────────────────────────

function ClientPanel({ client }: { client: Client | null }) {
  if (!client) return <div className="bg-black" />;

  const metrics = client.metricConfigs.slice(0, 7);
  const sentiment = client.sentimentSnapshot;
  const overallStatus = clientOverallStatus(metrics);

  const lowCount = metrics.filter((m) => m.snapshots[0]?.alertStatus === "LOW").length;
  const highCount = metrics.filter((m) => m.snapshots[0]?.alertStatus === "HIGH").length;
  const lowDays = lowCount > 0 ? maxDaysForStatus(metrics, "LOW") : 0;
  const highDays = highCount > 0 ? maxDaysForStatus(metrics, "HIGH") : 0;

  const borderColor =
    overallStatus === "LOW"
      ? "border-l-red-500"
      : overallStatus === "HIGH"
        ? "border-l-emerald-500"
        : "border-l-zinc-700";

  const vSize = valueSize(metrics.length);

  return (
    <div
      className={`flex flex-col border-l-[5px] ${borderColor} bg-[#0f0f17] border border-zinc-800/40 overflow-hidden`}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-8 py-5 border-b border-zinc-800/40">
        {client.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={client.logoUrl}
            alt={client.name}
            className="h-10 w-10 object-contain rounded-lg shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-white tracking-tight truncate">
            {client.name}
          </h2>
          <span className="text-xs text-zinc-600">afgelopen 30 dagen</span>
        </div>

        {/* Alert pills met leeftijd */}
        <div className="flex items-center gap-2 shrink-0">
          {lowCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 border border-red-500/25 px-2.5 py-0.5 text-xs font-medium text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_#ef4444]" />
              {lowCount} laag · {lowDays}d
            </span>
          )}
          {highCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
              {highCount} hoog · {highDays}d
            </span>
          )}
        </div>
      </div>

      {/* ── Metrics ── */}
      <div className="flex-1 flex flex-col justify-center px-8 py-4 gap-3">
        {metrics.length === 0 && (
          <p className="text-zinc-600 text-base">Geen metrics geconfigureerd</p>
        )}

        {metrics.map((m) => {
          const snap = m.snapshots[0];
          const status = snap?.alertStatus ?? "NONE";

          const dotClass =
            status === "HIGH"
              ? "bg-emerald-500 shadow-[0_0_10px_#10b981]"
              : status === "LOW"
                ? "bg-red-500 shadow-[0_0_10px_#ef4444]"
                : "bg-zinc-600";

          const valueColor =
            status === "HIGH"
              ? "text-emerald-400"
              : status === "LOW"
                ? "text-red-400"
                : "text-zinc-300";

          const trendValues = m.snapshots.map((s) => s.value);

          return (
            <div key={m.id} className="flex items-center gap-4">
              {/* Status dot */}
              <div className={`w-3 h-3 rounded-full shrink-0 ${dotClass}`} />

              {/* Value */}
              <div className={`font-mono font-bold tabular-nums shrink-0 ${vSize} ${valueColor}`} style={{ minWidth: "9ch" }}>
                {snap ? formatValue(snap.value, m.thresholdUnit) : "—"}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <span className="text-zinc-300 text-base font-medium truncate block">{m.label}</span>
              </div>

              {/* Sparkline */}
              <Sparkline
                values={trendValues}
                previousValue={snap?.previousValue}
                alertStatus={snap?.alertStatus}
              />
            </div>
          );
        })}
      </div>

      {/* ── Sentiment footer ── */}
      {sentiment && sentiment.emailsAnalyzed > 0 && (
        <div className="border-t border-zinc-800/40 px-8 py-4 flex items-center gap-3">
          {sentiment.hasEscalation ? (
            <>
              <span className="text-red-400 text-sm">⚠</span>
              <span className="text-red-400 text-sm font-medium">Escalatie gesignaleerd</span>
            </>
          ) : (
            <>
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  sentiment.overallScore > 0.2
                    ? "bg-emerald-500"
                    : sentiment.overallScore < -0.2
                      ? "bg-red-500"
                      : "bg-zinc-500"
                }`}
              />
              <span className="text-zinc-500 text-sm">
                Sentiment{" "}
                <span
                  className={
                    sentiment.overallScore > 0.2
                      ? "text-emerald-400"
                      : sentiment.overallScore < -0.2
                        ? "text-red-400"
                        : "text-zinc-400"
                  }
                >
                  {sentiment.overallScore >= 0 ? "+" : ""}
                  {sentiment.overallScore.toFixed(2)}
                </span>
                {" · "}
                <span className="text-zinc-600">{sentiment.trend}</span>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CastView ─────────────────────────────────────────────────────────────────

export function CastView({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [progressKey, setProgressKey] = useState(0);
  const cancelRef = useRef(false);

  const totalPages = Math.max(1, Math.ceil(clients.length / 3));

  // ── Page rotation ────────────────────────────────────────────────────────
  useEffect(() => {
    if (totalPages <= 1) return;
    cancelRef.current = false;

    const timer = setTimeout(async () => {
      if (cancelRef.current) return;
      setOpacity(0);
      await new Promise<void>((r) => setTimeout(r, FADE_MS));
      if (cancelRef.current) return;
      setPage((p) => (p + 1) % totalPages);
      setProgressKey((k) => k + 1);
      await new Promise<void>((r) => setTimeout(r, 50));
      if (cancelRef.current) return;
      setOpacity(1);
    }, ROTATE_MS);

    return () => {
      cancelRef.current = true;
      clearTimeout(timer);
    };
  }, [page, totalPages]);

  // ── Data refresh ─────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => router.refresh(), DATA_REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  const visible: (Client | null)[] = [
    clients[page * 3] ?? null,
    clients[page * 3 + 1] ?? null,
    clients[page * 3 + 2] ?? null,
  ];

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden", background: "black" }}>
      {/* 2×2 grid — bottom-left intentionally black */}
      <div
        className="absolute inset-0 grid grid-cols-2 grid-rows-2"
        style={{ opacity, transition: `opacity ${FADE_MS}ms ease-in-out` }}
      >
        <ClientPanel client={visible[0]} />
        <ClientPanel client={visible[1]} />
        <div className="bg-black" />
        <ClientPanel client={visible[2]} />
      </div>

      {/* ── Progress bar ── */}
      {totalPages > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-900">
          <div key={progressKey} className="cast-progress h-full bg-zinc-600" />
        </div>
      )}

      {/* ── Page dots ── */}
      {totalPages > 1 && (
        <div className="absolute bottom-4 right-5 flex items-center gap-2">
          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-500 ${
                i === page ? "w-5 h-2 bg-zinc-400" : "w-2 h-2 bg-zinc-700"
              }`}
            />
          ))}
        </div>
      )}

      {/* ── Terug naar Control Room ── */}
      <a
        href="/control-room"
        className="absolute top-4 left-4 flex items-center gap-2 rounded-lg border border-zinc-700/60 bg-zinc-900/80 px-3 py-2 text-sm font-medium text-zinc-400 opacity-0 transition-opacity duration-300 hover:opacity-100 hover:text-white backdrop-blur-sm focus-visible:opacity-100"
        title="Terug naar Control Room"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Control Room
      </a>
    </div>
  );
}
