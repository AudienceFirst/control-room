"use client";

import { useState } from "react";
import { getGa4ConnectUrl, disconnectGa4 } from "@/app/actions/ga4-oauth";

interface GA4ConnectionCardProps {
  connected: boolean;
  connectedBy: string | null;
  lastRefreshedAt: Date | null;
}

export function GA4ConnectionCard({
  connected,
  connectedBy,
  lastRefreshedAt,
}: GA4ConnectionCardProps) {
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      const url = await getGa4ConnectUrl();
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        "Disconnect GA4? You'll need to reconnect to fetch analytics data."
      )
    )
      return;
    setLoading(true);
    try {
      await disconnectGa4();
      window.location.reload();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-zinc-700/80 bg-zinc-800/40 p-6">
      <h3 className="mb-2 text-lg font-medium text-white">
        GA4 — Workspace connection
      </h3>
      <p className="mb-4 text-sm text-zinc-400">
        Connect met ruben@zuid.com of mcc@zuid.com om GA4-data van klanten op
        te halen. Eén keer verbinden geldt voor alle clients. Geen service
        account of rechten toevoegen bij de klant nodig.
      </p>

      {connected ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
              ● Connected
            </span>
            {connectedBy && (
              <span className="text-sm text-zinc-500">als {connectedBy}</span>
            )}
          </div>
          {lastRefreshedAt && (
            <p className="mt-2 text-xs text-zinc-500">
              Laatst vernieuwd:{" "}
              {new Date(lastRefreshedAt).toLocaleString("nl-NL")}
            </p>
          )}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={loading}
              className="rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50"
            >
              Ontkoppelen
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={loading}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50"
        >
          {loading ? "Redirecting…" : "Connect GA4 (OAuth)"}
        </button>
      )}
    </div>
  );
}
