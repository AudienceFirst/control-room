const DEFAULT_POSITIVE = [
  "great", "excellent", "perfect", "love", "fantastic", "happy",
  "satisfied", "thank you", "thanks", "appreciate", "impressed", "well done",
  "awesome", "amazing", "excited", "thrilled", "goed", "uitstekend",
  "tevreden", "dankje", "bedankt", "mooi", "fijn", "graag", "prettig",
  "top", "prima", "akkoord", "duidelijk", "succes", "plezier", "blij",
  "smooth", "efficient", "helder", "oplossing",
];

const DEFAULT_NEGATIVE = [
  "disappointed", "frustrated", "unhappy", "concern", "issue", "problem",
  "delay", "late", "overdue", "mistake", "wrong", "poor", "terrible",
  "urgent", "escalate", "unacceptable", "teleurgesteld", "probleem",
  "vertraagd", "fout", "slecht", "jammer", "helaas", "lastig", "moeilijk",
  "bezwaar", "klacht", "onduidelijk", "misverstand", "ongemak", "spijt",
];

const DEFAULT_ESCALATION = [
  "urgent", "asap", "immediately", "unacceptable", "legal", "lawyer",
  "refund", "cancel", "escalate", "complaint", "spoed", "onacceptabel",
];

export interface ScoredEmail {
  messageId: string;
  snippet: string;
  subject: string;
  date: string;
  score: number;
  isEscalation: boolean;
}

export interface SentimentSummary {
  overallScore: number;
  trend: "STABLE" | "IMPROVING" | "DECLINING";
  emailsAnalyzed: number;
  lastEmailAt: string | null;
  hasEscalation: boolean;
  escalationSnippet: string | null;
  analyzedAt: string;
}

export function scoreEmail(
  snippet: string,
  subject: string,
  config?: {
    positiveKeywords?: string[];
    negativeKeywords?: string[];
    escalationKeywords?: string[];
  }
): { score: number; isEscalation: boolean } {
  const positive = config?.positiveKeywords ?? DEFAULT_POSITIVE;
  const negative = config?.negativeKeywords ?? DEFAULT_NEGATIVE;
  const escalation = config?.escalationKeywords ?? DEFAULT_ESCALATION;

  const text = `${subject} ${snippet}`.toLowerCase();

  const positiveMatches = positive.filter((kw) =>
    text.includes(kw.toLowerCase())
  ).length;

  const negativeMatches = negative.filter((kw) =>
    text.includes(kw.toLowerCase())
  ).length;

  const isEscalation = escalation.some((kw) =>
    text.includes(kw.toLowerCase())
  );

  const totalSignals = positiveMatches + negativeMatches;
  // No sentiment keywords: slight positive bias ("no negative news is good news")
  if (totalSignals === 0) return { score: 0.15, isEscalation };

  const score =
    (positiveMatches - negativeMatches) / Math.max(totalSignals, 3);
  return {
    score: Math.max(-1, Math.min(1, score)),
    isEscalation,
  };
}

function average(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export function aggregateSentiment(scoredEmails: ScoredEmail[]): SentimentSummary {
  if (scoredEmails.length === 0) {
    return {
      overallScore: 0,
      trend: "STABLE",
      emailsAnalyzed: 0,
      lastEmailAt: null,
      hasEscalation: false,
      escalationSnippet: null,
      analyzedAt: new Date().toISOString(),
    };
  }

  const now = Date.now();
  let weightedSum = 0;
  let totalWeight = 0;

  for (const email of scoredEmails) {
    const ageDays = (now - new Date(email.date).getTime()) / (1000 * 60 * 60 * 24);
    const weight = Math.exp(-ageDays / 14);
    weightedSum += email.score * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  const midpoint = Math.floor(scoredEmails.length / 2);
  const firstHalfAvg = average(
    scoredEmails.slice(0, midpoint).map((e) => e.score)
  );
  const secondHalfAvg = average(scoredEmails.slice(midpoint).map((e) => e.score));
  const trend: "STABLE" | "IMPROVING" | "DECLINING" =
    secondHalfAvg - firstHalfAvg > 0.1
      ? "IMPROVING"
      : secondHalfAvg - firstHalfAvg < -0.1
        ? "DECLINING"
        : "STABLE";

  const escalationEmail = scoredEmails.find((e) => e.isEscalation);

  return {
    overallScore: Math.round(overallScore * 100) / 100,
    trend,
    emailsAnalyzed: scoredEmails.length,
    lastEmailAt: scoredEmails[0]?.date ?? null,
    hasEscalation: !!escalationEmail,
    escalationSnippet: escalationEmail
      ? escalationEmail.snippet.slice(0, 120)
      : null,
    analyzedAt: new Date().toISOString(),
  };
}
