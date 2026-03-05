"use client";

import { useState } from "react";
import { saveClickUpConfig } from "@/app/actions/clickup";

interface ClickUpConfigFormProps {
  clientId: string;
  config: {
    clientFolderId: string;
    estimatesFolderId: string | null;
    projectsFolderId: string | null;
    showCompletedDays: number;
  } | null;
}

export function ClickUpConfigForm({ clientId, config }: ClickUpConfigFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      const result = await saveClickUpConfig(clientId, formData);
      setSuccess(
        result.discovery.estimatesList || result.discovery.projectsList
          ? "ClickUp configured! Found lists: " +
              [
                result.discovery.estimatesList?.name,
                result.discovery.projectsList?.name,
              ]
                .filter(Boolean)
                .join(", ")
          : "ClickUp configured (no Estimates/Projects lists found by name)"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          {success}
        </div>
      )}

      <div>
        <label
          htmlFor="clientFolderId"
          className="block text-sm font-medium text-zinc-300"
        >
          Folder or Space ID
        </label>
        <input
          id="clientFolderId"
          name="clientFolderId"
          type="text"
          required
          defaultValue={config?.clientFolderId ?? ""}
          placeholder="e.g. 90123456789"
          className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
        <p className="mt-1 text-xs text-zinc-500">
          From the URL when viewing the client&apos;s folder or space in ClickUp
        </p>
      </div>

      <div>
        <label
          htmlFor="showCompletedDays"
          className="block text-sm font-medium text-zinc-300"
        >
          Show completed tasks (days)
        </label>
        <input
          id="showCompletedDays"
          name="showCompletedDays"
          type="number"
          min={1}
          max={30}
          defaultValue={config?.showCompletedDays ?? 7}
          className="mt-1 w-24 rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {config?.estimatesFolderId && (
        <p className="text-sm text-zinc-400">
          ✓ Estimates list: {config.estimatesFolderId}
        </p>
      )}
      {config?.projectsFolderId && (
        <p className="text-sm text-zinc-400">
          ✓ Projects list: {config.projectsFolderId}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 disabled:opacity-50"
      >
        {loading ? "Saving…" : "Verify & Save"}
      </button>
    </form>
  );
}
