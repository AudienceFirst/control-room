import { NextRequest, NextResponse } from "next/server";
import { checkAllTokenHealth } from "@/lib/token-health";

export const dynamic = "force-dynamic";

/**
 * GET /api/health — Connection health overview.
 * Protected by CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") ??
    request.nextUrl.searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const health = await checkAllTokenHealth();
    return NextResponse.json({
      ok: health.degraded === 0,
      ...health,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
