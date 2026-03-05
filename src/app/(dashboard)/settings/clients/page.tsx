import Link from "next/link";
import { prisma } from "@/lib/db";
import { GA4ConnectionCard } from "./GA4ConnectionCard";

export const dynamic = "force-dynamic";

export default async function ClientsListPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;

  const ga4Connection = await prisma.ga4Connection.findFirst();

  const clients = await prisma.client.findMany({
    include: {
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-full px-8 py-6 lg:px-10">
      {connected === "ga4" && (
        <div className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400" role="status">
          GA4 verbonden — je kunt nu property IDs per client instellen
        </div>
      )}
      {error?.startsWith("ga4_") && (
        <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
          {error === "ga4_config"
            ? "Server misconfiguration: ENCRYPTION_KEY moet gezet zijn."
            : error === "ga4_expired"
              ? "Verbinding verlopen. Probeer opnieuw."
              : "GA4 verbinding mislukt. Probeer opnieuw."}
        </div>
      )}

      <GA4ConnectionCard
        connected={!!ga4Connection}
        connectedBy={ga4Connection?.connectedBy ?? null}
        lastRefreshedAt={ga4Connection?.lastRefreshedAt ?? null}
      />

      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Clients
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Beheer clients en hun integraties
          </p>
        </div>
        <Link
          href="/settings/clients/new"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
        >
          Client toevoegen
        </Link>
      </header>

      <div className="mt-8">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/30 px-8 py-16 text-center">
            <p className="text-base font-medium text-zinc-300">Nog geen clients</p>
            <p className="mt-2 max-w-sm text-sm text-zinc-500">
              Voeg je eerste client toe om te beginnen.
            </p>
            <Link
              href="/settings/clients/new"
              className="mt-6 inline-flex rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
            >
              Client toevoegen
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-700/80">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-800/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-300">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-300">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-300">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-300">
                    Created by
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-zinc-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b border-zinc-700/50 transition-colors hover:bg-zinc-800/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/settings/clients/${client.id}`}
                        className="font-medium text-white hover:underline"
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {client.slug}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          client.isActive
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-zinc-600/50 text-zinc-400"
                        }`}
                      >
                        {client.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {client.createdBy?.name || client.createdBy?.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/settings/clients/${client.id}`}
                        className="text-sm font-medium text-zinc-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 focus-visible:rounded"
                      >
                        Bewerken
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
