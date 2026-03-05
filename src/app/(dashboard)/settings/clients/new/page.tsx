"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/app/actions/clients";

export default function NewClientPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    try {
      await createClient(formData);
      router.push("/settings/clients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client");
    }
  }

  return (
    <div className="min-h-full px-8 py-6 lg:px-10">
      <div className="mb-8">
        <Link
          href="/settings/clients"
          className="text-sm text-zinc-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 focus-visible:rounded"
        >
          ← Terug naar clients
        </Link>
      </div>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Nieuwe client
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Voeg een client toe om te monitoren in de Control Room
        </p>
      </header>

      <form action={handleSubmit} className="mt-8 max-w-md space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-zinc-300"
          >
            Client name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="e.g. Acme Corp"
          />
        </div>

        <div>
          <label
            htmlFor="slug"
            className="block text-sm font-medium text-zinc-300"
          >
            Slug (URL-safe identifier)
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="e.g. acme-corp (auto-generated if empty)"
          />
        </div>

        <div>
          <label
            htmlFor="logoUrl"
            className="block text-sm font-medium text-zinc-300"
          >
            Logo URL (optional)
          </label>
          <input
            id="logoUrl"
            name="logoUrl"
            type="url"
            className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="https://..."
          />
        </div>

        <div>
          <label
            htmlFor="clientLead"
            className="block text-sm font-medium text-zinc-300"
          >
            Client lead (optional)
          </label>
          <select
            id="clientLead"
            name="clientLead"
            className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 transition-colors focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="">— Geen —</option>
            <option value="Kyra">Kyra</option>
            <option value="Merel">Merel</option>
            <option value="Rinze">Rinze</option>
            <option value="Quincy">Quincy</option>
            <option value="Annemarieke">Annemarieke</option>
            <option value="Pieter">Pieter</option>
            <option value="Ruben">Ruben</option>
            <option value="Sander">Sander</option>
            <option value="Mathieu">Mathieu</option>
          </select>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Create Client
          </button>
          <Link
            href="/settings/clients"
            className="rounded-lg border border-zinc-600 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
          >
            Annuleren
          </Link>
        </div>
      </form>
    </div>
  );
}
