"use client";

import { useRouter, usePathname } from "next/navigation";
import { ClientSettingsForm } from "./ClientSettingsForm";
import { ClickUpConfigForm } from "./ClickUpConfigForm";
import { GA4ConfigForm } from "./GA4ConfigForm";
import { FunnelConfigForm } from "./FunnelConfigForm";
import { MetricsConfigTab } from "./MetricsConfigTab";
import { GmailConfigForm } from "./GmailConfigForm";
import { GA4ConnectionCard } from "../GA4ConnectionCard";
import { HubSpotConfigForm } from "./HubSpotConfigForm";
import { DashboardShareCard } from "./DashboardShareCard";

type Tab = "general" | "integrations" | "metrics" | "funnel" | "sentiment";

interface ClientSettingsTabsProps {
  initialTab?: string;
  client: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    clientLead: string | null;
    isActive: boolean;
    createdAt: Date;
    createdBy: { name: string | null; email: string | null } | null;
    clickupConfig: {
      clientFolderId: string;
      estimatesFolderId: string | null;
      projectsFolderId: string | null;
      showCompletedDays: number;
    } | null;
    hubspotConnection: {
      id: string;
      portalId: string;
      hubDomain: string | null;
      isValid: boolean;
      lastRefreshedAt: Date;
      tokenExpiresAt: Date;
    } | null;
    ga4Config: { ga4PropertyId: string } | null;
    ga4Connection: {
      connectedBy: string | null;
      lastRefreshedAt: Date;
    } | null;
    gmailConnection: {
      id: string;
      emailAddress: string;
      filterSenders: string;
      lookbackDays: number;
      isValid: boolean;
      lastRefreshedAt: Date;
    } | null;
    sentimentSnapshot: {
      overallScore: number;
      trend: string;
      emailsAnalyzed: number;
      lastEmailAt: Date | null;
      hasEscalation: boolean;
      escalationSnippet: string | null;
      detailsJson: string | null;
      analyzedAt: Date;
    } | null;
    metricConfigs: Array<{
      id: string;
      label: string;
      dataSource: string;
      metricKey: string;
      category: string;
      thresholdLow: number | null;
      thresholdHigh: number | null;
      thresholdUnit: string | null;
      snapshots: Array<{
        value: number;
        previousValue: number | null;
        alertStatus: string;
        capturedAt: Date;
      }>;
    }>;
    hasDashboardToken?: boolean;
    funnelConfig: {
      campaignNames: string;
      stepsJson: string;
    } | null;
  };
}

export function ClientSettingsTabs({ client, initialTab }: ClientSettingsTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = (["general", "integrations", "metrics", "funnel", "sentiment"].includes(initialTab ?? "")
    ? (initialTab as Tab)
    : "general") ?? "general";
  const hasFunnel = !!client.funnelConfig;

  function switchTab(tab: Tab) {
    router.replace(`${pathname}?tab=${tab}`);
  }

  return (
    <>
      <div className="mb-6 flex gap-1 border-b border-zinc-700/80" role="tablist" aria-label="Client instellingen">
        {[
          { key: "general" as Tab, label: "Algemeen" },
          { key: "integrations" as Tab, label: "Integraties" },
          { key: "metrics" as Tab, label: "Metrics" },
          ...(hasFunnel ? [{ key: "funnel" as Tab, label: "Funnel" }] : []),
          { key: "sentiment" as Tab, label: "Sentiment" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={activeTab === t.key}
            aria-controls={`panel-${t.key}`}
            id={`tab-${t.key}`}
            onClick={() => switchTab(t.key)}
            className={`rounded-t-md px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 ${
              activeTab === t.key
                ? "border-b-2 border-white bg-zinc-800/30 text-white"
                : "text-zinc-500 hover:bg-zinc-800/20 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <div role="tabpanel" id="panel-general" aria-labelledby="tab-general">
        <div className="space-y-8">
          <ClientSettingsForm
            client={{
              id: client.id,
              name: client.name,
              slug: client.slug,
              logoUrl: client.logoUrl,
              clientLead: client.clientLead ?? null,
              isActive: client.isActive,
            }}
          />
          <DashboardShareCard
            clientId={client.id}
            clientSlug={client.slug}
            hasDashboardToken={client.hasDashboardToken ?? false}
          />
        </div>
        </div>
      )}

      {activeTab === "integrations" && (
        <div role="tabpanel" id="panel-integrations" aria-labelledby="tab-integrations">
        <div className="space-y-8">
          <GA4ConnectionCard
            connected={!!client.ga4Connection}
            connectedBy={client.ga4Connection?.connectedBy ?? null}
            lastRefreshedAt={client.ga4Connection?.lastRefreshedAt ?? null}
          />
          <HubSpotConfigForm
            clientId={client.id}
            connection={client.hubspotConnection}
          />
          <div className="rounded-xl border border-zinc-700/80 bg-zinc-800/40 p-6">
            <h3 className="mb-4 text-lg font-medium text-white">GA4 Analytics</h3>
            <p className="mb-4 text-sm text-zinc-400">
              Als GA4 hierboven verbonden is, vul dan de Property ID in voor deze client.
            </p>
            <GA4ConfigForm
              clientId={client.id}
              config={client.ga4Config}
            />
          </div>
          <div className="rounded-xl border border-zinc-700/80 bg-zinc-800/40 p-6">
            <h3 className="mb-4 text-lg font-medium text-white">
              ClickUp Tasks
            </h3>
            <p className="mb-4 text-sm text-zinc-400">
              Connect a ClickUp folder to show task counts and status in the
              Control Room. Folder should contain lists named with "Estimate" or
              "Project".
            </p>
            <ClickUpConfigForm
              clientId={client.id}
              config={client.clickupConfig}
            />
          </div>
          <div className="rounded-xl border border-zinc-700/80 bg-zinc-800/40 p-6">
            <h3 className="mb-2 text-lg font-medium text-white">Gmail Sentiment</h3>
            <p className="mb-4 text-sm text-zinc-400">
              Verbind Gmail om e-mailcommunicatie te analyseren op sentiment. Ga naar de Sentiment-tab om te configureren.
            </p>
            <button
              type="button"
              onClick={() => switchTab("sentiment")}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
            >
              Naar Sentiment →
            </button>
          </div>
        </div>
        </div>
      )}

      {activeTab === "funnel" && hasFunnel && client.funnelConfig && (
        <div role="tabpanel" id="panel-funnel" aria-labelledby="tab-funnel">
          <div className="rounded-xl border border-zinc-700/80 bg-zinc-800/40 p-6">
            <h3 className="mb-4 text-lg font-medium text-white">Funnel (bestelstraat)</h3>
            <FunnelConfigForm
              clientId={client.id}
              clientSlug={client.slug}
              campaignNames={JSON.parse(client.funnelConfig.campaignNames || "[]") as string[]}
              steps={JSON.parse(client.funnelConfig.stepsJson || "[]")}
            />
          </div>
        </div>
      )}

      {activeTab === "sentiment" && (
        <div role="tabpanel" id="panel-sentiment" aria-labelledby="tab-sentiment">
          <GmailConfigForm
            clientId={client.id}
            connection={client.gmailConnection}
            sentiment={client.sentimentSnapshot}
          />
        </div>
      )}

      {activeTab === "metrics" && (
        <div role="tabpanel" id="panel-metrics" aria-labelledby="tab-metrics">
        <MetricsConfigTab
          clientId={client.id}
          metrics={client.metricConfigs}
          hasGa4={!!client.ga4Connection && !!client.ga4Config}
          hasHubSpot={!!client.hubspotConnection}
        />
        </div>
      )}

    </>
  );
}
