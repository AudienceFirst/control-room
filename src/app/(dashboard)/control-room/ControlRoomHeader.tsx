"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshAllClientsData } from "@/app/actions/control-room";

export function ControlRoomHeader() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefreshAll() {
    setRefreshing(true);
    try {
      const result = await refreshAllClientsData();
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

  return (
    <header className="relative z-10 mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white lg:text-3xl">
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
        <p className="mt-2 text-sm text-zinc-400">
          Alles komt hier samen · metrics, taken, sentiment en integraties in één hub
        </p>
      </div>
      <button
        type="button"
        onClick={handleRefreshAll}
        disabled={refreshing}
        className="flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/60 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-emerald-500/40 hover:bg-zinc-700/80 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50"
        title="Vernieuw alle clients: metrics, sentiment, ClickUp"
      >
        <span className="text-lg">{refreshing ? "…" : "↻"}</span>
        {refreshing ? "Vernieuwen…" : "Vernieuw alles"}
      </button>
    </header>
  );
}
