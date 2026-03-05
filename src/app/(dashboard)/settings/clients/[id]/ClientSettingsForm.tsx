"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateClient, deleteClient } from "@/app/actions/clients";

const CLIENT_LEADS = [
  "Kyra",
  "Merel",
  "Rinze",
  "Quincy",
  "Annemarieke",
  "Pieter",
  "Ruben",
  "Sander",
  "Mathieu",
] as const;

interface Client {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  clientLead: string | null;
  isActive: boolean;
}

export function ClientSettingsForm({ client }: { client: Client }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    try {
      await updateClient(client.id, formData);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update client");
    }
  }

  return (
    <form action={handleSubmit} className="max-w-md space-y-4">
      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
          Client updated successfully
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-zinc-300">
          Client name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={client.name}
          required
          className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-zinc-300">
          Slug
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          defaultValue={client.slug}
          className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      <div>
        <label htmlFor="logoUrl" className="block text-sm font-medium text-zinc-300">
          Logo URL
        </label>
        <input
          id="logoUrl"
          name="logoUrl"
          type="url"
          defaultValue={client.logoUrl ?? ""}
          className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      <div>
        <label htmlFor="clientLead" className="block text-sm font-medium text-zinc-300">
          Client lead
        </label>
        <select
          id="clientLead"
          name="clientLead"
          defaultValue={client.clientLead ?? ""}
          className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">— Geen —</option>
          {CLIENT_LEADS.map((lead) => (
            <option key={lead} value={lead}>
              {lead}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <label
          htmlFor="isActive"
          className="relative inline-flex cursor-pointer items-center"
        >
          <input
            id="isActive"
            name="isActive"
            type="checkbox"
            value="true"
            defaultChecked={client.isActive}
            className="peer sr-only"
          />
          <div className="h-6 w-11 rounded-full bg-zinc-600 peer-checked:bg-emerald-500 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-white/20"></div>
          <span className="ml-3 text-sm text-zinc-300">Active</span>
        </label>
      </div>

      <div className="flex items-center gap-4 pt-4">
        <button
          type="submit"
          className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
        >
          Opslaan
        </button>
      </div>

      <div className="mt-12 border-t border-zinc-700/80 pt-8">
        <h4 className="mb-2 text-sm font-medium text-zinc-400">Gevaarlijke actie</h4>
        <p className="mb-4 text-sm text-zinc-500">
          Verwijder deze klant permanent. Alle gekoppelde integraties (HubSpot, Gmail, GA4, ClickUp), metrics en sentimentdata worden ook verwijderd.
        </p>
        <button
          type="button"
          disabled={deleting}
          onClick={async () => {
            if (!confirm(`Weet je zeker dat je "${client.name}" wilt verwijderen? Dit kan niet ongedaan worden.`)) return;
            setDeleting(true);
            setError(null);
            try {
              await deleteClient(client.id);
              router.push("/settings/clients");
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Verwijderen mislukt");
              setDeleting(false);
            }
          }}
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 focus-visible:outline-offset-2"
        >
          {deleting ? "Bezig…" : "Klant verwijderen"}
        </button>
      </div>
    </form>
  );
}
