import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildTaskSummary } from "@/lib/integrations/clickup/aggregate";
import { verifyClientDashboardToken } from "@/app/actions/dashboard-token";
import { fetchFunnelData } from "@/lib/funnel";
import { NIEUwestroom_FUNNEL_STEPS } from "@/types/funnel";
import { ClientDashboardView } from "./ClientDashboardView";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function ClientDashboardPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const { token } = await searchParams;
  const session = await auth();

  let allowed = false;
  if (session?.user?.id) {
    allowed = true;
  } else {
    if (!token?.trim()) {
      notFound();
    }
    const valid = await verifyClientDashboardToken(slug, token);
    if (!valid) {
      notFound();
    }
    allowed = true;
  }

  if (!allowed) {
    notFound();
  }

  const client = await prisma.client.findUnique({
    where: { slug },
    include: {
      metricConfigs: {
        include: {
          snapshots: {
            orderBy: { capturedAt: "desc" },
            take: 1,
          },
        },
      },
      sentimentSnapshot: true,
      clickupConfig: true,
      funnelConfig: true,
      ga4Config: true,
      hubspotConnection: true,
      gmailConnection: { select: { id: true } },
    },
  });

  if (!client) {
    notFound();
  }

  let tasks = null;
  if (client.clickupConfig) {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10000)
      );
      tasks = await Promise.race([
        buildTaskSummary(client.clickupConfig),
        timeout,
      ]);
    } catch {
      tasks = null;
    }
  }

  // Ensure Nieuwestroom has a funnel config (default steps)
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

  let funnelData = null;
  if (funnelConfig) {
    const steps = JSON.parse(funnelConfig.stepsJson || "[]") as typeof NIEUwestroom_FUNNEL_STEPS;
    const campaignNames = JSON.parse(funnelConfig.campaignNames || "[]") as string[];
    if (steps.length > 0) {
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 15000)
        );
        funnelData = await Promise.race([
          fetchFunnelData({
            steps,
            campaignNames,
            ga4PropertyId: client.ga4Config?.ga4PropertyId ?? null,
            hasHubSpot: !!client.hubspotConnection,
            clientId: client.id,
          }),
          timeout,
        ]);
      } catch {
        funnelData = null;
      }
    }
  }

  const dashboardData = {
    id: client.id,
    name: client.name,
    slug: client.slug,
    logoUrl: client.logoUrl,
    metricConfigs: client.metricConfigs.map((m) => ({
      id: m.id,
      label: m.label,
      dataSource: m.dataSource,
      thresholdUnit: m.thresholdUnit,
      snapshots: m.snapshots.map((s) => ({
        value: s.value,
        previousValue: s.previousValue,
        alertStatus: s.alertStatus,
      })),
    })),
    sentimentSnapshot: client.sentimentSnapshot
      ? {
          overallScore: client.sentimentSnapshot.overallScore,
          trend: client.sentimentSnapshot.trend,
          emailsAnalyzed: client.sentimentSnapshot.emailsAnalyzed,
          hasEscalation: client.sentimentSnapshot.hasEscalation,
          escalationSnippet: client.sentimentSnapshot.escalationSnippet,
        }
      : null,
  };

  return (
    <ClientDashboardView
      client={dashboardData}
      tasks={tasks}
      funnel={funnelData}
    />
  );
}
