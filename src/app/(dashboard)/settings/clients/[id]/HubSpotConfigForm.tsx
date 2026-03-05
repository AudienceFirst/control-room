"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getHubSpotConnectUrl, refreshHubSpotConnection, disconnectHubSpot } from "@/app/actions/hubspot";

interface HubSpotConfigFormProps {
  clientId: string;
  connection: {
    id: string;
    portalId: string;
    hubDomain: string | null;
    isValid: boolean;
    lastRefreshedAt: Date;
    tokenExpiresAt: Date;
  } | null;
}

export function HubSpotConfigForm({ clientId, connection }: HubSpotConfigFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      const url = await getHubSpotConnectUrl(clientId);
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await refreshHubSpotConnection(clientId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error(err);
      alert("Refresh mislukt");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect HubSpot? You'll need to reconnect to fetch CRM data.")) return;
    setLoading(true);
    try {
      await disconnectHubSpot(clientId);
      window.location.reload();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  const statusBadge = () => {
    if (!connection) return null;
    if (!connection.isValid) {
      return (
        <span className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
          ○ Error — Reconnect needed
        </span>
      );
    }
    const expiresAt = new Date(connection.tokenExpiresAt).getTime();
    const oneHourFromNow = Date.now() + 60 * 60 * 1000;
    if (expiresAt < oneHourFromNow) {
      return (
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
          ◐ Expiring soon
        </span>
      );
    }
    return (
      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
        ● Connected
      </span>
    );
  };

  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-800/40 p-6">
      <h3 className="mb-4 text-lg font-medium text-white">HubSpot CRM</h3>

      {connection ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge()}
            {connection.portalId !== "pending" && (
              <span className="text-sm text-zinc-400">
                Portal: {connection.hubDomain ?? connection.portalId}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Last refreshed: {new Date(connection.lastRefreshedAt).toLocaleString("nl-NL")}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50"
            >
              {refreshing ? "Vernieuwen…" : "Vernieuw token"}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={loading}
              className="rounded-lg border border-zinc-600 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-zinc-400">
            Connect a HubSpot portal to fetch contacts, deals, and companies for
            this client.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading}
            className="rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50"
          >
            {loading ? "Redirecting…" : "Connect HubSpot"}
          </button>
        </>
      )}
    </div>
  );
}
