"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFunnelCampaigns } from "@/app/actions/funnel";
import type { FunnelStepDef } from "@/types/funnel";

interface FunnelConfigFormProps {
  clientId: string;
  clientSlug: string;
  campaignNames: string[];
  steps: FunnelStepDef[];
}

export function FunnelConfigForm({
  clientId,
  clientSlug,
  campaignNames,
  steps,
}: FunnelConfigFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(
    campaignNames.length > 0 ? campaignNames.join("\n") : ""
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const names = value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await updateFunnelCampaigns(clientId, names);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error ?? "Opslaan mislukt");
      }
    } catch {
      alert("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">
        De funnel op het dashboard toont stappen van landingpagina tot klant. Vul hier de
        campagnenamen in (één per regel) om alleen verkeer van die campagnes mee te tellen.
        Laat leeg voor alle verkeersbronnen.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label htmlFor="funnel-campaigns" className="block text-sm font-medium text-zinc-300">
          Campagnenamen (optioneel)
        </label>
        <textarea
          id="funnel-campaigns"
          rows={4}
          className="w-full rounded-lg border border-zinc-600 bg-zinc-800/60 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Bijv.:&#10;Google Ads - Awareness&#10;Meta - Conversion&#10;LinkedIn - Awareness"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Opslaan…" : "Campagnes opslaan"}
        </button>
      </form>
      <div>
        <h4 className="mb-2 text-sm font-medium text-zinc-300">Funnelstappen</h4>
        <ol className="list-inside list-decimal space-y-1 text-sm text-zinc-400">
          {steps.sort((a, b) => a.order - b.order).map((s) => (
            <li key={s.order}>{s.label}</li>
          ))}
        </ol>
      </div>
      <p className="text-xs text-zinc-500">
        Dashboard: <a href={`/d/${clientSlug}`} className="text-blue-400 hover:underline">/d/{clientSlug}</a>
      </p>
    </div>
  );
}
