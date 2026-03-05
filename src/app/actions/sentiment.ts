"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getValidGmailToken } from "@/lib/integrations/gmail/token";
import { fetchClientEmailThreads, testGmailFetch } from "@/lib/integrations/gmail/client";
import { scoreEmail, aggregateSentiment, type ScoredEmail } from "@/lib/sentiment/keyword-scorer";
import { scoreEmailsWithGemini } from "@/lib/sentiment/gemini-scorer";
import { scoreEmailsWithGroq } from "@/lib/sentiment/groq-scorer";
import { revalidatePath } from "next/cache";

export async function testGmailEmailFetch(clientId: string): Promise<{
  ok: boolean;
  steps?: Array<{ query: string; count: number }>;
  error?: string;
  sampleFrom?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Unauthorized" };
  const connection = await prisma.gmailConnection.findUnique({ where: { clientId } });
  if (!connection) return { ok: false, error: "Gmail niet verbonden" };
  const token = await getValidGmailToken(clientId);
  if (!token) return { ok: false, error: "Token verlopen — verbind opnieuw" };
  const filterSenders = parseFilterSenders(connection.filterSenders);
  const result = await testGmailFetch({
    accessToken: token,
    filterSenders,
    lookbackDays: 14,
  });
  return result;
}

function parseFilterSenders(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export async function refreshSentiment(clientId: string): Promise<{
  success: boolean;
  error?: string;
  geminiError?: string;
  allSnippetsEmpty?: boolean;
}> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const connection = await prisma.gmailConnection.findUnique({
    where: { clientId },
  });

  if (!connection) {
    return { success: false, error: "Gmail niet verbonden" };
  }

  const token = await getValidGmailToken(clientId);
  if (!token) {
    return { success: false, error: "Token verlopen — verbind opnieuw" };
  }

  const filterSenders = parseFilterSenders(connection.filterSenders);

  if (filterSenders.length === 0) {
    await prisma.sentimentSnapshot.upsert({
      where: { clientId },
      create: {
        clientId,
        overallScore: 0,
        trend: "STABLE",
        emailsAnalyzed: 0,
        lastEmailAt: null,
        hasEscalation: false,
        escalationSnippet: null,
        detailsJson: null,
      },
      update: {
        overallScore: 0,
        trend: "STABLE",
        emailsAnalyzed: 0,
        lastEmailAt: null,
        hasEscalation: false,
        escalationSnippet: null,
        detailsJson: null,
      },
    });
    revalidatePath(`/settings/clients/${clientId}`);
    revalidatePath("/control-room");
    return { success: true };
  }

  try {
    const messages = await fetchClientEmailThreads({
      accessToken: token,
      filterSenders,
      lookbackDays: 14,
      maxMessages: 100,
    });

    // No emails found — preserve existing sentiment instead of overwriting with 0
    if (messages.length === 0) {
      console.log(`[Sentiment] No emails found for client ${clientId}, keeping existing snapshot`);
      revalidatePath(`/settings/clients/${clientId}`);
      revalidatePath("/control-room");
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

    const allSnippetsEmpty =
      emailInputs.length > 0 && emailInputs.every((e) => !e.snippet);

    const keywordScored: ScoredEmail[] = emailInputs.map((e) => {
      const { score, isEscalation } = scoreEmail(e.snippet, e.subject);
      return { messageId: e.id, snippet: e.snippet, subject: e.subject, date: e.date, score, isEscalation };
    });

    let scored: ScoredEmail[] = keywordScored;
    let detailsJson: string | null = null;
    let geminiError: string | undefined;

    if (process.env.GROQ_API_KEY) {
      try {
        const result = await scoreEmailsWithGroq(emailInputs);
        scored = result.scored;
        detailsJson = JSON.stringify(result.details);
      } catch (err) {
        geminiError = err instanceof Error ? err.message : String(err);
        console.warn("[Sentiment] Groq failed, trying Gemini:", err);
        if (process.env.GEMINI_API_KEY) {
          try {
            const result = await scoreEmailsWithGemini(emailInputs);
            scored = result.scored;
            detailsJson = result.details ? JSON.stringify(result.details) : null;
            geminiError = undefined;
          } catch (gErr) {
            geminiError = gErr instanceof Error ? gErr.message : String(gErr);
            console.warn("[Sentiment] Gemini failed, falling back to keywords:", gErr);
            scored = keywordScored;
          }
        } else {
          scored = keywordScored;
        }
      }
    } else if (process.env.GEMINI_API_KEY) {
      try {
        const result = await scoreEmailsWithGemini(emailInputs);
        scored = result.scored;
        detailsJson = result.details ? JSON.stringify(result.details) : null;
      } catch (err) {
        geminiError = err instanceof Error ? err.message : String(err);
        console.warn("[Sentiment] Gemini failed, falling back to keywords:", err);
        scored = keywordScored;
      }
    } else {
      geminiError = "GROQ_API_KEY of GEMINI_API_KEY niet gezet in .env";
      scored = keywordScored;
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

    revalidatePath(`/settings/clients/${clientId}`);
    revalidatePath("/control-room");
    return {
      success: true,
      geminiError,
      allSnippetsEmpty: allSnippetsEmpty || undefined,
    };
  } catch (err) {
    // On error, preserve existing snapshot — don't reset to 0
    console.error("[Sentiment] Refresh failed (keeping existing snapshot):", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Onbekende fout",
    };
  }

}

export async function updateGmailConfig(
  clientId: string,
  data: { filterSenders?: string[]; lookbackDays?: number }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const connection = await prisma.gmailConnection.findUnique({
    where: { clientId },
  });

  if (!connection) {
    return { success: false, error: "Gmail niet verbonden" };
  }

  const updates: { filterSenders?: string; lookbackDays?: number } = {};
  if (data.filterSenders != null) {
    updates.filterSenders = JSON.stringify(data.filterSenders);
  }
  if (data.lookbackDays != null) {
    updates.lookbackDays = data.lookbackDays;
  }

  await prisma.gmailConnection.update({
    where: { clientId },
    data: updates,
  });

  revalidatePath(`/settings/clients/${clientId}`);
  return { success: true };
}
