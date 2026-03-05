import { prisma } from "@/lib/db";
import { getValidGmailToken } from "@/lib/integrations/gmail/token";
import { fetchClientEmailThreads } from "@/lib/integrations/gmail/client";
import { scoreEmail, aggregateSentiment, type ScoredEmail } from "@/lib/sentiment/keyword-scorer";
import { scoreEmailsWithGemini } from "@/lib/sentiment/gemini-scorer";
import { scoreEmailsWithGroq } from "@/lib/sentiment/groq-scorer";
import { fetchGA4Metric } from "@/lib/integrations/ga4/client";
import {
  fetchHubSpotMetric,
} from "@/lib/integrations/hubspot/client";

function parseFilterSenders(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Refresh sentiment for a single client. No auth check — caller must verify authorization.
 */
export async function refreshSentimentInternal(clientId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const connection = await prisma.gmailConnection.findUnique({
    where: { clientId },
  });

  if (!connection) return { success: false, error: "Gmail niet verbonden" };

  const token = await getValidGmailToken(clientId);
  if (!token) return { success: false, error: "Token verlopen" };

  const filterSenders = parseFilterSenders(connection.filterSenders);

  if (filterSenders.length === 0) {
    return { success: true };
  }

  try {
    const messages = await fetchClientEmailThreads({
      accessToken: token,
      filterSenders,
      lookbackDays: 14,
      maxMessages: 100,
    });

    if (messages.length === 0) {
      console.log(`[Cron] No emails for client ${clientId}, keeping existing snapshot`);
      return { success: true };
    }

    const emailInputs = messages.map((m) => ({
      id: m.id,
      snippet: (m.snippet ?? "").trim(),
      subject: m.subject ?? "",
      date: m.internalDate
        ? new Date(parseInt(m.internalDate, 10)).toISOString()
        : new Date().toISOString(),
    }));

    const keywordScored: ScoredEmail[] = emailInputs.map((e) => {
      const { score, isEscalation } = scoreEmail(e.snippet, e.subject);
      return { messageId: e.id, snippet: e.snippet, subject: e.subject, date: e.date, score, isEscalation };
    });

    let scored: ScoredEmail[] = keywordScored;
    let detailsJson: string | null = null;

    if (process.env.GROQ_API_KEY) {
      try {
        const result = await scoreEmailsWithGroq(emailInputs);
        scored = result.scored;
        detailsJson = JSON.stringify(result.details);
      } catch (err) {
        console.warn("[Cron] Groq failed, trying Gemini:", err);
        if (process.env.GEMINI_API_KEY) {
          try {
            const result = await scoreEmailsWithGemini(emailInputs);
            scored = result.scored;
            detailsJson = result.details ? JSON.stringify(result.details) : null;
          } catch (gErr) {
            console.warn("[Cron] Gemini failed, falling back to keywords:", gErr);
            scored = keywordScored;
          }
        }
      }
    } else if (process.env.GEMINI_API_KEY) {
      try {
        const result = await scoreEmailsWithGemini(emailInputs);
        scored = result.scored;
        detailsJson = result.details ? JSON.stringify(result.details) : null;
      } catch (err) {
        console.warn("[Cron] Gemini failed, falling back to keywords:", err);
        scored = keywordScored;
      }
    }

    const summary = aggregateSentiment(scored);

    const upsertData = {
      overallScore: summary.overallScore,
      trend: summary.trend,
      emailsAnalyzed: summary.emailsAnalyzed,
      lastEmailAt: summary.lastEmailAt ? new Date(summary.lastEmailAt) : null,
      hasEscalation: summary.hasEscalation,
      escalationSnippet: summary.escalationSnippet ?? null,
      detailsJson: detailsJson ?? null,
    };

    await prisma.sentimentSnapshot.upsert({
      where: { clientId },
      create: { clientId, ...upsertData },
      update: upsertData,
    });

    return { success: true };
  } catch (err) {
    console.error("[Cron] Sentiment refresh failed (keeping existing):", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Refresh a single metric value. No auth check — caller must verify authorization.
 */
export async function refreshMetricInternal(metricConfigId: string): Promise<number | null> {
  const config = await prisma.metricConfig.findUnique({
    where: { id: metricConfigId },
    include: {
      client: {
        include: { ga4Config: true, hubspotConnection: true },
      },
    },
  });
  if (!config) return null;

  let value: number;

  if (config.dataSource === "GA4") {
    const ga4Config = config.client.ga4Config;
    if (!ga4Config) return null;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const endStr = yesterday.toISOString().slice(0, 10);
    const startDate = new Date(yesterday);
    startDate.setDate(startDate.getDate() - 29);
    const startStr = startDate.toISOString().slice(0, 10);
    value = await fetchGA4Metric({
      propertyId: ga4Config.ga4PropertyId,
      metricName: config.metricKey,
      startDate: startStr,
      endDate: endStr,
    });
  } else if (config.dataSource === "HUBSPOT") {
    if (!config.client.hubspotConnection) return null;
    value = await fetchHubSpotMetric(config.clientId, config.category, config.metricKey, 30, {
      excludeToday: true,
    });
  } else {
    return null;
  }

  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() - 1);
  windowEnd.setHours(23, 59, 59, 999);
  const windowStart = new Date(windowEnd);
  windowStart.setDate(windowStart.getDate() - 29);

  const latest = await prisma.metricSnapshot.findFirst({
    where: { metricConfigId },
    orderBy: { capturedAt: "desc" },
  });

  const alertStatus =
    config.thresholdLow != null && value < config.thresholdLow
      ? "LOW"
      : config.thresholdHigh != null && value > config.thresholdHigh
        ? "HIGH"
        : "NORMAL";

  await prisma.metricSnapshot.create({
    data: {
      metricConfigId,
      windowStart,
      windowEnd,
      value,
      previousValue: latest?.value ?? undefined,
      alertStatus,
    },
  });

  return value;
}

/**
 * Refresh all data for a single client. No auth check.
 */
export async function refreshClientInternal(clientId: string): Promise<void> {
  const configs = await prisma.metricConfig.findMany({
    where: { clientId },
    select: { id: true },
  });

  await refreshSentimentInternal(clientId).catch((err) => {
    console.warn(`[Cron] Sentiment for ${clientId} failed:`, err);
  });

  await Promise.all(
    configs.map((c) =>
      refreshMetricInternal(c.id).catch((err) => {
        console.warn(`[Cron] Metric ${c.id} failed:`, err);
      })
    )
  );
}
