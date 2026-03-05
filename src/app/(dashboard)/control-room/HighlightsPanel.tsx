"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { acknowledgeHighlight, acknowledgeAllHighlights } from "@/app/actions/control-room";

function formatValue(value: number, unit: string | null): string {
  if (unit === "percentage") return `${value.toFixed(1)}%`;
  if (unit === "currency") return `€${value.toLocaleString("nl-NL")}`;
  return value.toLocaleString("nl-NL");
}

function formatDaysOld(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

export type HighlightItem =
  | {
      type: "metric";
      clientName: string;
      clientId: string;
      label: string;
      value: number;
      unit: string | null;
      highlightKey: string;
      isNew: boolean;
      daysOld: number;
    }
  | {
      type: "sentiment";
      clientName: string;
      clientId: string;
      score: number;
      emailsAnalyzed: number;
      highlightKey: string;
      isNew: boolean;
      daysOld: number;
    }
  | {
      type: "task_overdue";
      clientName: string;
      clientId: string;
      count: number;
      highlightKey: string;
      isNew: boolean;
      daysOld: number;
    }
  | {
      type: "metric_resolved";
      clientName: string;
      clientId: string;
      label: string;
      value: number;
      unit: string | null;
      highlightKey: string;
      wasHigh: boolean;
      resolvedDaysAgo: number;
    };

interface HighlightsPanelProps {
  greenItems: HighlightItem[];
  redItems: HighlightItem[];
  resolvedItems: HighlightItem[];
}

type ActiveHighlightItem = Exclude<HighlightItem, { type: "metric_resolved" }>;

function ItemRow({
  item,
  variant,
  onNavigate,
  onMarkSeen,
}: {
  item: ActiveHighlightItem;
  variant: "green" | "red";
  onNavigate: () => void;
  onMarkSeen: (key: string) => void;
}) {
  const dotClass = variant === "green" ? "bg-emerald-500" : "bg-red-500";
  const textClass = variant === "green" ? "text-emerald-400" : "text-red-400";
  const [marking, setMarking] = useState(false);

  async function handleMarkSeen(e: React.MouseEvent) {
    e.stopPropagation();
    if (marking) return;
    setMarking(true);
    await onMarkSeen(item.highlightKey);
    setMarking(false);
  }

  const mainContent = (
    <>
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white">{item.clientName}</p>
        <p className="text-xs text-zinc-400">
          {item.type === "metric" && (
            <>
              <span className={`font-mono tabular-nums ${textClass}`}>{formatValue(item.value, item.unit)}</span> · {item.label}
            </>
          )}
          {item.type === "sentiment" && (
            <>
              Sentiment: <span className={textClass}>{item.score.toFixed(2)}</span> · {item.emailsAnalyzed} e-mails
            </>
          )}
          {item.type === "task_overdue" && (
            <span className={textClass}>{item.count} overdue</span>
          )}
        </p>
      </div>
      <span className="shrink-0 rounded bg-zinc-700/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 tabular-nums">
        {item.daysOld}d
      </span>
      {item.isNew && (
        <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
          New
        </span>
      )}
    </>
  );

  return (
    <div className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-800/60">
      <button
        type="button"
        onClick={onNavigate}
        className="flex min-w-0 flex-1 items-start gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-1"
      >
        {mainContent}
      </button>
      <button
        type="button"
        onClick={handleMarkSeen}
        disabled={marking || !item.isNew}
        title="Mark as seen"
        className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
        aria-label="Mark as seen"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>
    </div>
  );
}

function ResolvedItemRow({
  item,
  onNavigate,
}: {
  item: Extract<HighlightItem, { type: "metric_resolved" }>;
  onNavigate: () => void;
}) {
  const wasColor = item.wasHigh ? "text-emerald-400" : "text-red-400";

  return (
    <button
      type="button"
      onClick={onNavigate}
      className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-zinc-800/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-1"
    >
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-zinc-400">{item.clientName}</p>
        <p className="text-xs text-zinc-500">
          <span className={`font-mono tabular-nums ${wasColor}`}>
            {formatValue(item.value, item.unit)}
          </span>{" "}
          · {item.label}
        </p>
      </div>
      {item.resolvedDaysAgo === 0 ? (
        <span className="shrink-0 rounded bg-zinc-700/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
          vandaag
        </span>
      ) : (
        <span className="shrink-0 rounded bg-zinc-700/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 tabular-nums">
          {item.resolvedDaysAgo}d
        </span>
      )}
    </button>
  );
}

export function HighlightsPanel({ greenItems, redItems, resolvedItems }: HighlightsPanelProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const totalItems = greenItems.length + redItems.length;
  const allKeys = [...greenItems, ...redItems].map((i) => i.highlightKey);
  const newItems: Array<{ item: HighlightItem; variant: "red" | "green" }> = [
    ...redItems.filter((i) => i.isNew).map((item) => ({ item, variant: "red" as const })),
    ...greenItems.filter((i) => i.isNew).map((item) => ({ item, variant: "green" as const })),
  ];
  const redItemsSeen = redItems.filter((i) => !i.isNew);
  const greenItemsSeen = greenItems.filter((i) => !i.isNew);

  function navigateTo(item: HighlightItem) {
    router.push(`/settings/clients/${item.clientId}`);
  }

  async function handleMarkSeen(highlightKey: string) {
    await acknowledgeHighlight(highlightKey);
    router.refresh();
  }

  async function handleMarkAllSeen() {
    if (allKeys.length === 0 || markingAll) return;
    setMarkingAll(true);
    await acknowledgeAllHighlights(allKeys);
    router.refresh();
    setMarkingAll(false);
  }

  return (
    <>
      {/* Mobile toggle button */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 shadow-lg shadow-black/40 transition-colors hover:bg-zinc-800 lg:hidden"
        aria-label="Toggle highlights"
      >
        <svg className="h-5 w-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {totalItems > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {totalItems}
          </span>
        )}
      </button>

      {/* Overlay backdrop for mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`fixed right-0 top-0 z-20 h-screen w-72 shrink-0 border-l border-zinc-800 bg-zinc-950/95 backdrop-blur-sm transition-transform duration-200 lg:w-80 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Highlights</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Boven &amp; onder verwachting
              </p>
            </div>
            <div className="flex items-center gap-1">
              {newItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllSeen}
                  disabled={markingAll}
                  className="rounded px-2 py-1 text-xs text-zinc-400 transition-colors hover:text-white disabled:opacity-50"
                  title="Mark all as seen"
                >
                  {markingAll ? "…" : "Alles gezien"}
                </button>
              )}
              <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="rounded-md p-1 text-zinc-400 hover:text-white lg:hidden"
              aria-label="Close highlights"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            </div>
          </div>

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {newItems.length > 0 && (
            <section className="border-b border-zinc-800 p-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-amber-500/90">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
                </span>
                Nieuw ({newItems.length})
              </h3>
              <ul className="space-y-0.5">
                {newItems.map(({ item, variant }, i) => (
                  <li key={`new-${item.highlightKey}-${i}`}>
                    <ItemRow item={item} variant={variant} onNavigate={() => navigateTo(item)} onMarkSeen={handleMarkSeen} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {redItemsSeen.length > 0 && (
            <section className="border-b border-zinc-800 p-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-red-500/90">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
                </span>
                Aandacht nodig ({redItemsSeen.length})
              </h3>
              <ul className="space-y-0.5">
                {redItemsSeen.map((item, i) => (
                  <li key={`red-${item.highlightKey}-${i}`}>
                    <ItemRow item={item} variant="red" onNavigate={() => navigateTo(item)} onMarkSeen={handleMarkSeen} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {greenItemsSeen.length > 0 && (
            <section className={`p-3 ${resolvedItems.length > 0 ? "border-b border-zinc-800" : ""}`}>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-emerald-500/90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Boven verwachting ({greenItemsSeen.length})
              </h3>
              <ul className="space-y-0.5">
                {greenItemsSeen.map((item, i) => (
                  <li key={`green-${item.highlightKey}-${i}`}>
                    <ItemRow item={item} variant="green" onNavigate={() => navigateTo(item)} onMarkSeen={handleMarkSeen} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {resolvedItems.length > 0 && (
            <section className="p-3">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Opgelost – laatste 7d ({resolvedItems.length})
              </h3>
              <ul className="space-y-0.5">
                {resolvedItems.map((item, i) =>
                  item.type === "metric_resolved" ? (
                    <li key={`resolved-${item.highlightKey}-${i}`}>
                      <ResolvedItemRow item={item} onNavigate={() => navigateTo(item)} />
                    </li>
                  ) : null
                )}
              </ul>
            </section>
          )}

          {greenItems.length === 0 && redItems.length === 0 && resolvedItems.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/5">
                <svg className="h-5 w-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-300">Alles op koers</p>
                <p className="mt-1 text-xs text-zinc-500">Geen uitschieters gedetecteerd</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}
