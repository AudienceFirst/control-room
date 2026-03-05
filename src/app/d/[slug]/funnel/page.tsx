import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { verifyClientDashboardToken } from "@/app/actions/dashboard-token";
import { fetchNieuwestroomFunnelData } from "@/lib/funnel-nieuwestroom";
import {
  UTM_CAMPAIGNS,
  UTM_SOURCES,
  UTM_MEDIUMS,
  UTM_TERMS,
  UTM_CONTENTS,
  NIEUWESTROOM_CAMPAIGN,
  type UtmCampaign,
  type UtmSource,
  type UtmMedium,
  type UtmTerm,
  type UtmContent,
  type NieuwestroomUtmFilters,
} from "@/types/funnel";
import { NieuwestroomFunnelView } from "./NieuwestroomFunnelView";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function parseFilters(sp: Record<string, string | string[] | undefined>): NieuwestroomUtmFilters {
  const raw = (key: string) => {
    const v = sp[key];
    return typeof v === "string" ? v : "all";
  };

  const utmCampaign = (["all", ...UTM_CAMPAIGNS] as string[]).includes(raw("campaign"))
    ? (raw("campaign") as UtmCampaign)
    : NIEUWESTROOM_CAMPAIGN;

  const utmSource = (["all", ...UTM_SOURCES] as string[]).includes(raw("source"))
    ? (raw("source") as UtmSource)
    : "all";

  const utmMedium = (["all", ...UTM_MEDIUMS] as string[]).includes(raw("medium"))
    ? (raw("medium") as UtmMedium)
    : "all";

  const utmTerm = (["all", ...UTM_TERMS] as string[]).includes(raw("term"))
    ? (raw("term") as UtmTerm)
    : "all";

  const utmContent = (["all", ...UTM_CONTENTS] as string[]).includes(raw("content"))
    ? (raw("content") as UtmContent)
    : "all";

  return { utmCampaign, utmSource, utmMedium, utmTerm, utmContent };
}

export default async function NieuwestroomFunnelPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const session = await auth();

  // ── Auth: session OR shared token ────────────────────────────────────────
  let allowed = false;
  if (session?.user?.id) {
    allowed = true;
  } else {
    const token = typeof sp.token === "string" ? sp.token : undefined;
    if (!token?.trim()) notFound();
    const valid = await verifyClientDashboardToken(slug, token!);
    if (!valid) notFound();
    allowed = true;
  }
  if (!allowed) notFound();

  // ── Load client ───────────────────────────────────────────────────────────
  const client = await prisma.client.findUnique({
    where: { slug },
    include: {
      ga4Config: true,
      hubspotConnection: { select: { id: true } },
    },
  });

  if (!client) notFound();

  // ── Parse UTM filters from URL params ─────────────────────────────────────
  const filters = parseFilters(sp);

  // ── Fetch funnel data ─────────────────────────────────────────────────────
  let funnelData = null;
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 20_000)
    );
    funnelData = await Promise.race([
      fetchNieuwestroomFunnelData({
        filters,
        ga4PropertyId: client.ga4Config?.ga4PropertyId ?? null,
        hasHubSpot: !!client.hubspotConnection,
        clientId: client.id,
      }),
      timeout,
    ]);
  } catch {
    funnelData = null;
  }

  return (
    <NieuwestroomFunnelView
      clientName={client.name}
      clientSlug={client.slug}
      logoUrl={client.logoUrl ?? null}
      funnel={funnelData}
      activeFilters={filters}
    />
  );
}
