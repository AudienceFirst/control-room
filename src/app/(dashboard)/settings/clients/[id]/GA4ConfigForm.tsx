"use client";

import { useState } from "react";
import { saveGA4Config, removeGA4Config } from "@/app/actions/ga4";

interface GA4ConfigFormProps {
  clientId: string;
  config: { ga4PropertyId: string } | null;
}

export function GA4ConfigForm({ clientId, config }: GA4ConfigFormProps) {
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
      await saveGA4Config(clientId, formData);
      setSuccess("GA4 configured! Property connected successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save. Ensure GOOGLE_SERVICE_ACCOUNT_JSON is set and the service account has Viewer access to this GA4 property."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remove GA4 configuration?")) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await removeGA4Config(clientId);
      setSuccess("GA4 configuration removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
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
          htmlFor="ga4PropertyId"
          className="block text-sm font-medium text-zinc-300"
        >
          GA4 Property ID
        </label>
        <input
          id="ga4PropertyId"
          name="ga4PropertyId"
          type="text"
          required
          defaultValue={config?.ga4PropertyId ?? ""}
          placeholder="e.g. 123456789"
          className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Numeric property ID from GA4 Admin. The ZUID service account must have
          Viewer access to this property.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50"
        >
          {loading ? "Verifying…" : "Verify & Save"}
        </button>
        {config && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={loading}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>
    </form>
  );
}
