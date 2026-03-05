import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshClientInternal } from "@/lib/refresh";
import { checkAllTokenHealth } from "@/lib/token-health";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// In-memory rate limiter: minimum 2 minutes between runs
let lastRunAt = 0;
const MIN_INTERVAL_MS = 2 * 60 * 1000;

/**
 * GET /api/cron — Automatic refresh of all active clients.
 *
 * Protected by CRON_SECRET header or query param.
 * Rate limited to once per 2 minutes.
 * Call from Vercel Cron, external scheduler, or manually:
 *   curl "http://localhost:3001/api/cron?secret=YOUR_SECRET"
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret")
    ?? request.nextUrl.searchParams.get("secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  if (now - lastRunAt < MIN_INTERVAL_MS) {
    const waitSec = Math.ceil((MIN_INTERVAL_MS - (now - lastRunAt)) / 1000);
    return NextResponse.json(
      { error: `Rate limited — try again in ${waitSec}s` },
      { status: 429, headers: { "Retry-After": String(waitSec) } }
    );
  }
  lastRunAt = now;

  const startTime = now;
  console.log("[Cron] Starting scheduled refresh...");

  try {
    const clients = await prisma.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const results: Array<{ clientId: string; name: string; ok: boolean; ms: number; error?: string }> = [];

    // Process clients sequentially to avoid overwhelming APIs
    for (const client of clients) {
      const clientStart = Date.now();
      try {
        await refreshClientInternal(client.id);
        results.push({ clientId: client.id, name: client.name, ok: true, ms: Date.now() - clientStart });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Cron] Client ${client.name} failed:`, msg);
        results.push({ clientId: client.id, name: client.name, ok: false, ms: Date.now() - clientStart, error: msg });
      }
    }

    revalidatePath("/control-room");
    revalidatePath("/settings/clients");
    for (const client of clients) {
      revalidatePath(`/settings/clients/${client.id}`);
    }

    // Token health check — probes all OAuth tokens after refresh
    let tokenHealth: { healthy: number; degraded: number } = { healthy: 0, degraded: 0 };
    try {
      const health = await checkAllTokenHealth();
      tokenHealth = { healthy: health.healthy, degraded: health.degraded };
      if (health.degraded > 0) {
        console.warn(`[Cron] Token health: ${health.degraded} degraded connections`);
        for (const d of health.details) {
          if (d.hubspot && !d.hubspot.valid) console.warn(`  HubSpot invalid: ${d.clientName}`);
          if (d.gmail && !d.gmail.valid) console.warn(`  Gmail invalid: ${d.clientName}`);
        }
      }
    } catch (err) {
      console.warn("[Cron] Token health check failed:", err);
    }

    const elapsed = Date.now() - startTime;
    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    console.log(`[Cron] Done in ${elapsed}ms — ${succeeded} ok, ${failed} failed`);

    return NextResponse.json({
      ok: true,
      elapsed,
      clients: results.length,
      succeeded,
      failed,
      tokenHealth,
      details: results,
    });
  } catch (err) {
    console.error("[Cron] Fatal error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
