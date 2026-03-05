"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClickUpIcon,
  HubSpotIcon,
  GA4Icon,
  GmailIcon,
} from "@/components/IntegrationIcons";
import { refreshClientData } from "@/app/actions/control-room";
import type { TaskSummary } from "@/types/snapshot";

function sentimentColor(score: number) {
  if (score > 0.2) return "text-emerald-500";
  if (score >= -0.2) return "text-blue-500";
  return "text-red-500";
}

function sentimentBg(score: number) {
  if (score > 0.2) return "bg-emerald-500/15";
  if (score >= -0.2) return "bg-blue-500/10";
  return "bg-red-500/15";
}

export type ClientListItemProps = {
  client: {
    id: string;
    name: string;
    clientLead: string | null;
    clickupConfig: { clientFolderId: string } | null;
    hubspotConnection: {
      portalId: string;
      hubDomain: string | null;
      isValid?: boolean;
    } | null;
    ga4Config: { ga4PropertyId: string } | null;
    gmailConnection: { id: string; isValid?: boolean } | null;
  };
  clickupWorkspaceId?: string | null;
  hubspotRegion?: string;
  tasks: TaskSummary | null;
  sentiment?: {
    overallScore: number;
    emailsAnalyzed: number;
    trend: string;
    hasEscalation?: boolean;
  } | null;
};

function overallStatusDot(
  sentiment: ClientListItemProps["sentiment"],
  tasks: ClientListItemProps["tasks"],
): { color: string; pulse: boolean } {
  const hasOverdue = (tasks?.overdueCount ?? 0) > 0;
  const hasEscalation = sentiment?.hasEscalation;
  const negSentiment = sentiment && sentiment.overallScore < -0.2;

  if (hasOverdue || hasEscalation || negSentiment)
    return { color: "bg-red-500", pulse: !!hasEscalation };
  if (sentiment && sentiment.overallScore > 0.2)
    return { color: "bg-emerald-500", pulse: false };
  return { color: "bg-blue-500", pulse: false };
}

export function ClientListItem({
  client,
  tasks,
  sentiment,
  clickupWorkspaceId,
  hubspotRegion = "us",
}: ClientListItemProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const clickupUrl =
    client.clickupConfig && clickupWorkspaceId
      ? `https://app.clickup.com/${clickupWorkspaceId}/v/f/${client.clickupConfig.clientFolderId}`
      : null;
  const hubspotUrl = client.hubspotConnection
    ? hubspotRegion === "eu"
      ? `https://app-eu1.hubspot.com/contacts/${client.hubspotConnection.portalId}`
      : `https://app.hubspot.com/contacts/${client.hubspotConnection.portalId}`
    : null;
  const ga4Url = client.ga4Config
    ? `https://analytics.google.com/analytics/web/#/p${client.ga4Config.ga4PropertyId}`
    : null;
  const gmailUrl = client.gmailConnection
    ? `/settings/clients/${client.id}?tab=sentiment`
    : null;

  const status = overallStatusDot(sentiment, tasks);

  async function handleRefresh(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRefreshing(true);
    try {
      const result = await refreshClientData(client.id);
      if (result.success) router.refresh();
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <tr
      onClick={() => router.push(`/settings/clients/${client.id}`)}
      className="group cursor-pointer border-b border-zinc-800/80 transition-colors last:border-0 hover:bg-zinc-800/40"
    >
      <td className="py-3 pl-4 pr-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex h-2 w-2 shrink-0">
            {status.pulse && (
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full ${status.color} opacity-75`}
              />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${status.color}`}
            />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-white">{client.name}</p>
            {client.clientLead && (
              <span className="shrink-0 rounded-full bg-zinc-700/80 px-2 py-0.5 text-xs text-zinc-400">
                {client.clientLead}
              </span>
            )}
            {(client.hubspotConnection?.isValid === false ||
              client.gmailConnection?.isValid === false) && (
              <svg
                className="h-3.5 w-3.5 shrink-0 text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        {sentiment ? (
          <div className="flex items-center gap-1.5">
            <div
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium tabular-nums ${sentimentBg(sentiment.overallScore)} ${sentimentColor(sentiment.overallScore)}`}
            >
              {sentiment.overallScore.toFixed(2)}
              <span className="text-zinc-500">
                · {sentiment.emailsAnalyzed}
              </span>
            </div>
            {sentiment.hasEscalation && (
              <svg
                className="h-3.5 w-3.5 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                title="Escalatie gedetecteerd"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            )}
          </div>
        ) : (
          <span className="text-xs text-zinc-600">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        {tasks ? (
          <div className="flex items-center gap-2 text-sm">
            {tasks.overdueCount > 0 && (
              <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                {tasks.overdueCount} over
              </span>
            )}
            <span className="text-zinc-400">{tasks.incompleteCount} open</span>
          </div>
        ) : (
          <span className="text-xs text-zinc-600">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          <a
            href={clickupUrl ?? "#"}
            target={clickupUrl ? "_blank" : undefined}
            rel={clickupUrl ? "noopener noreferrer" : undefined}
            onClick={(e) => !clickupUrl && e.preventDefault()}
            className="p-1 opacity-80 hover:opacity-100"
          >
            <ClickUpIcon
              className="h-3.5 w-3.5"
              active={!!client.clickupConfig}
            />
          </a>
          <a
            href={hubspotUrl ?? "#"}
            target={hubspotUrl ? "_blank" : undefined}
            rel={hubspotUrl ? "noopener noreferrer" : undefined}
            onClick={(e) => !hubspotUrl && e.preventDefault()}
            className="p-1 opacity-80 hover:opacity-100"
          >
            <HubSpotIcon
              className="h-3.5 w-3.5"
              active={!!client.hubspotConnection}
            />
          </a>
          <a
            href={ga4Url ?? "#"}
            target={ga4Url ? "_blank" : undefined}
            rel={ga4Url ? "noopener noreferrer" : undefined}
            onClick={(e) => !ga4Url && e.preventDefault()}
            className="p-1 opacity-80 hover:opacity-100"
          >
            <GA4Icon className="h-3.5 w-3.5" active={!!client.ga4Config} />
          </a>
          <a
            href={gmailUrl ?? "#"}
            onClick={(e) => !gmailUrl && e.preventDefault()}
            className="p-1 opacity-80 hover:opacity-100"
          >
            <GmailIcon
              className="h-3.5 w-3.5"
              active={!!client.gmailConnection}
            />
          </a>
        </div>
      </td>
      <td className="py-3 pr-4 pl-2">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="rounded p-1.5 text-zinc-500 opacity-0 transition-opacity hover:text-white hover:bg-zinc-700 group-hover:opacity-100 disabled:opacity-50"
          title="Vernieuwen"
        >
          <span
            className={`inline-block text-sm ${refreshing ? "animate-spin-smooth" : ""}`}
          >
            ↻
          </span>
        </button>
      </td>
    </tr>
  );
}
