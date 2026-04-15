import { prisma } from "@/lib/db";
import { CastView } from "./CastView";

export const dynamic = "force-dynamic";

export default async function CastPage() {
  const clients = await prisma.client.findMany({
    where: { isActive: true },
    include: {
      sentimentSnapshot: true,
      metricConfigs: {
        include: {
          snapshots: {
            orderBy: { capturedAt: "desc" },
            take: 30,
          },
        },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return <CastView clients={clients} />;
}
