import { GoogleGenAI } from "@google/genai";
import type { ScoredEmail } from "./keyword-scorer";
import { parseAiJson } from "./parse-ai-json";

// gemini-2.0-flash deprecated; use 2.5 Flash
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export interface SentimentDetails {
  overallExplanation: string;
  emailDetails: Array<{
    subject: string;
    snippet: string;
    date: string;
    score: number;
    isEscalation: boolean;
    explanation: string;
    confidence?: number;
  }>;
}

const SENTIMENT_RESPONSE_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    overallExplanation: {
      type: "string",
      description: "Korte uitleg van het algemene sentiment (1-2 zinnen)",
    },
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          score: {
            type: "number",
            description: "Sentiment -1.0 (zeer negatief) tot 1.0 (zeer positief); 0 bij neutraal/ambigue",
          },
          isEscalation: {
            type: "boolean",
            description: "True bij urgentie, klacht, juridische dreiging",
          },
          explanation: {
            type: "string",
            description: "Korte uitleg voor deze e-mail (1 zin)",
          },
          confidence: {
            type: "number",
            description: "0-1: hoe eenduidig het sentiment; laag bij ambigue of puur informatief",
          },
        },
        required: ["score", "isEscalation", "explanation"],
      },
    },
  },
  required: ["overallExplanation", "results"],
};

async function scoreAllWithExplanations(
  ai: GoogleGenAI,
  emails: Array<{ subject: string; snippet: string; date: string }>
): Promise<{
  overallExplanation: string;
  results: Array<{ score: number; isEscalation: boolean; explanation: string; confidence?: number }>;
}> {
  const items = emails
    .map((e, i) => {
      const subject = (e.subject ?? "").slice(0, 100);
      const body = (e.snippet ?? "").slice(0, 900).trim();
      const content = body || "(alleen onderwerp beschikbaar)";
      return `[${i + 1}] Onderwerp: ${subject}\nInhoud: ${content}`;
    })
    .join("\n\n");

  const prompt = `Geef ALLEEN geldige JSON. Geen extra tekst of uitleg ervoor of erna.

Analyseer B2B client-agency e-mailsentiment. Richtlijnen:

- Overweeg zowel expliciete emotionele taal als impliciete tone-signalen: woordkeuze, interpunctie, zinsbouw.
- Professionele e-mails maskeren sentiment vaak met formeel taalgebruik — let op subtiele signalen.
- Korte e-mails (1-2 zinnen) hebben minder context maar kunnen duidelijk sentiment overbrengen.
- Gemengd sentiment: e-mail bevat zowel positieve als negatieve elementen — geef een gewogen score.
- confidence (0-1): weerspiegelt hoe eenduidig de sentiment-signalen zijn; laag bij ambigue of puur informatief.
- Bij ambigue sentiment of puur informatieve e-mails: classify als neutraal (score ≈ 0) met lage confidence.
- Als alleen onderwerp beschikbaar is: gebruik onderwerp en context voor zover mogelijk; geef lage confidence.

Per e-mail: score (-1.0 tot 1.0), isEscalation (urgentie/klacht/juridische dreiging), explanation (1 zin Nederlands), optioneel confidence.
overallExplanation: korte samenvatting (1-2 zinnen) van het algemene sentiment.

E-mails (zelfde volgorde in results):
${items}`;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: SENTIMENT_RESPONSE_SCHEMA,
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  });

  const text = (response.text ?? "").trim();
  type Parsed = {
    overallExplanation?: string;
    results?: Array<{
      score?: number;
      isEscalation?: boolean;
      explanation?: string;
      confidence?: number;
    }>;
  };

  const parsed = parseAiJson<Parsed>(text);
  if (!parsed) {
    console.warn("[Gemini] JSON parse failed, raw:", text.slice(0, 400));
    return {
      overallExplanation: "Parsing mislukt.",
      results: emails.map(() => ({ score: 0, isEscalation: false, explanation: "—" })),
    };
  }

  return {
    overallExplanation: parsed.overallExplanation ?? "Geen uitleg beschikbaar.",
    results: (parsed.results ?? []).map((r) => ({
      score: typeof r.score === "number" ? Math.max(-1, Math.min(1, r.score)) : 0,
      isEscalation: Boolean(r.isEscalation),
      explanation: typeof r.explanation === "string" ? r.explanation : "—",
      confidence: typeof r.confidence === "number" ? Math.max(0, Math.min(1, r.confidence)) : undefined,
    })),
  };
}

export async function scoreEmailsWithGemini(
  emails: Array<{ id: string; snippet: string; subject: string; date: string }>
): Promise<{ scored: ScoredEmail[]; details: SentimentDetails | null }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey });

  const { overallExplanation, results } = await scoreAllWithExplanations(ai, emails);

  const scored: ScoredEmail[] = emails.map((e, i) => ({
    messageId: e.id,
    snippet: e.snippet,
    subject: e.subject,
    date: e.date,
    score: results[i]?.score ?? 0,
    isEscalation: results[i]?.isEscalation ?? false,
  }));

  const details: SentimentDetails = {
    overallExplanation,
    emailDetails: emails.map((e, i) => ({
      subject: e.subject,
      snippet: e.snippet.slice(0, 200),
      date: e.date,
      score: results[i]?.score ?? 0,
      isEscalation: results[i]?.isEscalation ?? false,
      explanation: results[i]?.explanation ?? "—",
      confidence: results[i]?.confidence,
    })),
  };

  return { scored, details };
}
