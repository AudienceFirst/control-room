"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getLinkedInConnectUrl, disconnectLinkedIn } from "@/app/actions/linkedin-oauth";

interface LinkedInConfigFormProps {
  clientId: string;
  connection: {
    organizationId: string;
    organizationName: string;
    isValid: boolean;
    lastRefreshedAt: Date;
    tokenExpiresAt: Date;
  } | null;
}

export function LinkedInConfigForm({ clientId, connection }: LinkedInConfigFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    try {
      const url = await getLinkedInConnectUrl(clientId);
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm(
        "LinkedIn ontkoppelen? De volgers-metric en bijbehorende data worden ook verwijderd."
      )
    )
      return;
    setLoading(true);
    try {
      await disconnectLinkedIn(clientId);
      router.refresh();
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
          ○ Error — Opnieuw verbinden vereist
        </span>
      );
    }
    const expiresAt = new Date(connection.tokenExpiresAt).getTime();
    const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
    if (expiresAt < sevenDaysFromNow) {
      return (
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
          ◐ Verloopt binnenkort
        </span>
      );
    }
    return (
      <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400">
        ● Verbonden
      </span>
    );
  };

  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-800/40 p-6">
      <h3 className="mb-1 text-lg font-medium text-white">LinkedIn</h3>
      <p className="mb-4 text-sm text-zinc-400">
        Verbind een LinkedIn-bedrijfspagina om het volgersaantal automatisch bij te houden.
        De persoon die verbindt moet paginabeheerder zijn.
      </p>

      {connection ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge()}
            <span className="text-sm text-zinc-400">{connection.organizationName}</span>
            <span className="text-xs text-zinc-600">ID: {connection.organizationId}</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            Laatst bijgewerkt:{" "}
            {new Date(connection.lastRefreshedAt).toLocaleString("nl-NL")}
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Token verloopt:{" "}
            {new Date(connection.tokenExpiresAt).toLocaleDateString("nl-NL")}
            {" "}(LinkedIn tokens verlopen na 60 dagen — daarna opnieuw verbinden)
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleConnect}
              disabled={loading}
              className="rounded-lg bg-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50"
            >
              {loading ? "Bezig…" : "Opnieuw verbinden"}
            </button>
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
          className="rounded-lg bg-[#0A66C2] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0958a8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50"
        >
          {loading ? "Bezig…" : "Verbind via LinkedIn"}
        </button>
      )}
    </div>
  );
}
