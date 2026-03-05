"use client";

import { useState } from "react";
import {
  getOrCreateDashboardToken,
  regenerateDashboardToken,
} from "@/app/actions/dashboard-token";

type DashboardShareCardProps = {
  clientId: string;
  clientSlug: string;
  hasDashboardToken: boolean;
};

export function DashboardShareCard({
  clientId,
  clientSlug,
  hasDashboardToken,
}: DashboardShareCardProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayUrl = shareUrl;

  async function handleEnable() {
    setError(null);
    setLoading(true);
    try {
      const result = await getOrCreateDashboardToken(clientId);
      if (result.success && result.url) {
        setShareUrl(result.url);
      } else if (result.success && result.hasToken) {
        setShareUrl(null);
      } else {
        setError(result.error ?? "Failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    setError(null);
    setRegenerating(true);
    try {
      const result = await regenerateDashboardToken(clientId);
      if (result.success && result.url) {
        setShareUrl(result.url);
      } else {
        setError(result.error ?? "Failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed");
    }
  }

  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-800/40 p-6">
      <h3 className="mb-2 text-lg font-medium text-white">Dashboard link</h3>
      <p className="mb-4 text-sm text-zinc-400">
        Share a read-only dashboard with the client (e.g. embed in HubSpot).
        The link is secret; anyone with the link can view the dashboard.
      </p>
      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}
      {!hasDashboardToken && !shareUrl ? (
        <button
          type="button"
          onClick={handleEnable}
          disabled={loading}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50"
        >
          {loading ? "Bezig…" : "Enable dashboard share"}
        </button>
      ) : (
        <div className="space-y-3">
          {shareUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="min-w-0 flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-zinc-300"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              Dashboard link is active. Regenerate to get a new link (old link
              will stop working).
            </p>
          )}
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating}
            className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {regenerating ? "Bezig…" : "Regenerate link"}
          </button>
        </div>
      )}
    </div>
  );
}
