import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { NIEUwestroom_FUNNEL_STEPS } from "@/types/funnel";
import { ClientSettingsTabs } from "./ClientSettingsTabs";

export const dynamic = "force-dynamic";

export default async function ClientSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ connected?: string; error?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { connected, error, tab } = await searchParams;
  const [client, ga4Connection] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true, email: true } },
        clickupConfig: true,
        hubspotConnection: true,
        ga4Config: true,
        gmailConnection: true,
        sentimentSnapshot: true,
        dashboardToken: { select: { id: true } },
        funnelConfig: true,
        metricConfigs: {
          include: {
            snapshots: {
              orderBy: { capturedAt: "desc" },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.ga4Connection.findFirst({
      select: { connectedBy: true, lastRefreshedAt: true },
    }),
  ]);

  if (!client) {
    notFound();
  }

  // Ensure Nieuwestroom has a funnel config so the Funnel tab appears
  let funnelConfig = client.funnelConfig;
  if (client.slug === "nieuwestroom" && !funnelConfig) {
    funnelConfig = await prisma.funnelConfig.create({
      data: {
        clientId: client.id,
        campaignNames: JSON.stringify([]),
        stepsJson: JSON.stringify(NIEUwestroom_FUNNEL_STEPS),
      },
    });
  }

  return (
    <div className="min-h-full px-8 py-6 lg:px-10">
      <div className="mb-6">
        <Link
          href="/settings/clients"
          className="text-sm text-zinc-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 focus-visible:rounded"
        >
          ← Terug naar clients
        </Link>
        {connected === "hubspot" && (
          <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            HubSpot verbonden
          </div>
        )}
        {connected === "gmail" && (
          <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            Gmail verbonden — configureer filter afzenders op de Sentiment-tab
          </div>
        )}
        {error?.startsWith("hubspot_") && (
          <div className="mt-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error === "hubspot_config"
              ? "Server misconfiguration: ENCRYPTION_KEY must be set. Generate with: openssl rand -hex 32"
              : error === "hubspot_expired"
                ? "Connection timed out. Please try again."
                : "HubSpot connection failed. Please try again."}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-700/80 bg-zinc-800/40 p-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{client.name}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Created {client.createdAt.toLocaleDateString("nl-NL")} by{" "}
            {client.createdBy?.name || client.createdBy?.email || "—"}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <ClientSettingsTabs
          initialTab={tab}
          client={{
            ...client,
            clickupConfig: client.clickupConfig ?? null,
            hubspotConnection: client.hubspotConnection ?? null,
            ga4Config: client.ga4Config ?? null,
            ga4Connection: ga4Connection ?? null,
            gmailConnection: client.gmailConnection ?? null,
            sentimentSnapshot: client.sentimentSnapshot ?? null,
            hasDashboardToken: !!client.dashboardToken,
            funnelConfig: funnelConfig
              ? {
                  campaignNames: funnelConfig.campaignNames,
                  stepsJson: funnelConfig.stepsJson,
                }
              : null,
          }}
        />
      </div>
    </div>
  );
}
