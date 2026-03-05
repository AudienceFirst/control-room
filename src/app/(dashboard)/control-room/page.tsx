import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildTaskSummary } from "@/lib/integrations/clickup/aggregate";
import { ControlRoomBackground } from "@/components/ControlRoomBackground";
import type { HighlightItem } from "./HighlightsPanel";
import { ControlRoomView } from "./ControlRoomView";
import { HighlightsPanel } from "./HighlightsPanel";

export const dynamic = "force-dynamic";

/** Calendar days from date to today, minimum 1. */
function daysOldFrom(date: Date, to: Date = new Date()): number {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}

/** From snapshots ordered by capturedAt desc, find oldest consecutive run with same alertStatus; return days from that snapshot to today (min 1). */
function metricDaysOld(
  snapshots: Array<{ alertStatus: string; capturedAt: Date }>,
  currentStatus: string
): number {
  if (snapshots.length === 0) return 1;
  let i = 0;
  while (i < snapshots.length && snapshots[i].alertStatus === currentStatus) i++;
  const oldestInRun = snapshots[i - 1];
  return oldestInRun ? daysOldFrom(new Date(oldestInRun.capturedAt)) : 1;
}

type ClientForHighlights = {
  id: string;
  name: string;
  metricConfigs: Array<{
    id: string;
    label: string;
    thresholdUnit: string | null;
    snapshots: Array<{ value: number; alertStatus: string; capturedAt: Date }>;
  }>;
  sentimentSnapshot: {
    overallScore: number;
    emailsAnalyzed: number;
    hasEscalation: boolean;
    escalationSnippet: string | null;
    analyzedAt: Date;
  } | null;
};

/** Build highlights that were HIGH/LOW within the last 7 days but are currently NORMAL. */
function buildResolvedHighlights(clients: ClientForHighlights[]): HighlightItem[] {
  const resolved: HighlightItem[] = [];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const client of clients) {
    for (const m of client.metricConfigs) {
      const snap = m.snapshots[0];
      // Only consider metrics that are currently NORMAL (not an active highlight)
      if (!snap || snap.alertStatus !== "NORMAL") continue;

      // Find the most recent non-NORMAL snapshot going back in history
      const lastAlert = m.snapshots.find(
        (s) => s.alertStatus === "HIGH" || s.alertStatus === "LOW"
      );
      if (!lastAlert) continue;

      // Only show as "recently resolved" if the alert was within the last 7 days
      if (new Date(lastAlert.capturedAt) < sevenDaysAgo) continue;

      // Find how many days the metric has been NORMAL (oldest NORMAL in current run)
      let resolvedAt = snap.capturedAt;
      for (const s of m.snapshots) {
        if (s.alertStatus === "NORMAL") {
          resolvedAt = s.capturedAt;
        } else {
          break;
        }
      }

      resolved.push({
        type: "metric_resolved",
        clientName: client.name,
        clientId: client.id,
        label: m.label,
        value: lastAlert.value,
        unit: m.thresholdUnit,
        highlightKey: `${client.id}:metric:${m.id}`,
        wasHigh: lastAlert.alertStatus === "HIGH",
        resolvedDaysAgo: Math.max(0, daysOldFrom(new Date(resolvedAt)) - 1),
      });
    }
  }

  return resolved;
}

function buildHighlights(
  clients: ClientForHighlights[],
  tasksByClient: Array<{ tasks: { overdueCount: number } | null }>,
  acknowledgedKeys: Set<string>
): { green: HighlightItem[]; red: HighlightItem[]; activeKeys: string[] } {
  const green: HighlightItem[] = [];
  const red: HighlightItem[] = [];
  const activeKeys: string[] = [];

  clients.forEach((client, i) => {
    // Metrics: HIGH = above expectation (green), LOW = below (red)
    for (const m of client.metricConfigs) {
      const snap = m.snapshots[0];
      if (!snap) continue;
      if (snap.alertStatus === "HIGH") {
        const highlightKey = `${client.id}:metric:${m.id}`;
        activeKeys.push(highlightKey);
        const daysOld = metricDaysOld(m.snapshots, "HIGH");
        green.push({
          type: "metric",
          clientName: client.name,
          clientId: client.id,
          label: m.label,
          value: snap.value,
          unit: m.thresholdUnit,
          highlightKey,
          isNew: !acknowledgedKeys.has(highlightKey),
          daysOld,
        });
      } else if (snap.alertStatus === "LOW") {
        const highlightKey = `${client.id}:metric:${m.id}`;
        activeKeys.push(highlightKey);
        const daysOld = metricDaysOld(m.snapshots, "LOW");
        red.push({
          type: "metric",
          clientName: client.name,
          clientId: client.id,
          label: m.label,
          value: snap.value,
          unit: m.thresholdUnit,
          highlightKey,
          isNew: !acknowledgedKeys.has(highlightKey),
          daysOld,
        });
      }
    }

    // Sentiment: >0.2 green, <-0.2 red (blauw/neutraal overslaan)
    if (client.sentimentSnapshot) {
      const s = client.sentimentSnapshot;
      if (s.overallScore > 0.2) {
        const highlightKey = `${client.id}:sentiment`;
        activeKeys.push(highlightKey);
        const daysOld = daysOldFrom(new Date(s.analyzedAt));
        green.push({
          type: "sentiment",
          clientName: client.name,
          clientId: client.id,
          score: s.overallScore,
          emailsAnalyzed: s.emailsAnalyzed,
          highlightKey,
          isNew: !acknowledgedKeys.has(highlightKey),
          daysOld,
        });
      } else if (s.overallScore < -0.2) {
        const highlightKey = `${client.id}:sentiment`;
        activeKeys.push(highlightKey);
        const daysOld = daysOldFrom(new Date(s.analyzedAt));
        red.push({
          type: "sentiment",
          clientName: client.name,
          clientId: client.id,
          score: s.overallScore,
          emailsAnalyzed: s.emailsAnalyzed,
          highlightKey,
          isNew: !acknowledgedKeys.has(highlightKey),
          daysOld,
        });
      }
    }

    // Tasks: overdue = red
    const tasks = tasksByClient[i]?.tasks;
    if (tasks && tasks.overdueCount > 0) {
      const highlightKey = `${client.id}:task_overdue`;
      activeKeys.push(highlightKey);
      red.push({
        type: "task_overdue",
        clientName: client.name,
        clientId: client.id,
        count: tasks.overdueCount,
        highlightKey,
        isNew: !acknowledgedKeys.has(highlightKey),
        daysOld: 1,
      });
    }
  });

  return { green, red, activeKeys };
}

export default async function ControlRoomPage() {
  const clients = await prisma.client.findMany({
    where: { isActive: true },
    include: {
      clickupConfig: true,
      hubspotConnection: true,
      ga4Config: true,
      gmailConnection: true,
      sentimentSnapshot: true,
      metricConfigs: {
        include: {
          snapshots: {
            orderBy: { capturedAt: "desc" },
            take: 30,
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const tasksByClient = await Promise.all(
    clients.map(async (client) => {
      if (!client.clickupConfig) return { tasks: null, error: null };
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 30000)
        );
        const tasks = await Promise.race([
          buildTaskSummary(client.clickupConfig),
          timeout,
        ]);
        return { tasks, error: null };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Control Room] Failed to load tasks for ${client.name}:`, err);
        return { tasks: null, error: msg };
      }
    })
  );

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const acknowledgedKeys = new Set<string>();
  if (userId) {
    const acks = await prisma.highlightAcknowledgment.findMany({
      where: { userId },
      select: { highlightKey: true },
    });
    acks.forEach((a) => acknowledgedKeys.add(a.highlightKey));
  }

  const { green: greenItems, red: redItems, activeKeys } = buildHighlights(
    clients as ClientForHighlights[],
    tasksByClient,
    acknowledgedKeys
  );

  const resolvedItems = buildResolvedHighlights(clients as ClientForHighlights[]);

  // Clear acknowledgments for keys no longer in the current red/green list
  if (activeKeys.length > 0) {
    await prisma.highlightAcknowledgment.deleteMany({
      where: { highlightKey: { notIn: activeKeys } },
    });
  }

  return (
    <div className="relative">
      <div className="relative px-4 py-6 sm:px-6 md:px-8 lg:px-10 lg:pr-84">
        <ControlRoomBackground />
        <ControlRoomView
          clients={clients}
          tasksByClient={tasksByClient}
          clickupWorkspaceId={process.env.CLICKUP_WORKSPACE_ID ?? null}
          hubspotRegion={process.env.HUBSPOT_REGION ?? "us"}
        />
      </div>

      <HighlightsPanel greenItems={greenItems} redItems={redItems} resolvedItems={resolvedItems} />
    </div>
  );
}
