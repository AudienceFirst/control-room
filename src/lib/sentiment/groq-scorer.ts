import type { ScoredEmail } from "./keyword-scorer";
import { parseAiJson } from "./parse-ai-json";

// Groq free tier: ~30 rpm (vs Gemini 5 rpm)
const MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";

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

const PROMPT = `Je bent een sentiment-analist. Analyseer B2B client-agency e-mails.

Richtlijnen:
- Overweeg zowel expliciete emotionele taal als impliciete tone-signalen: woordkeuze, interpunctie, zinsbouw.
- Professionele e-mails maskeren sentiment vaak met formeel taalgebruik — let op subtiele signalen.
- Korte e-mails (1-2 zinnen) hebben minder context maar kunnen duidelijk sentiment overbrengen.
- Gemengd sentiment: e-mail bevat zowel positieve als negatieve elementen — geef een gewogen score.
- confidence (0-1): weerspiegelt hoe eenduidig de sentiment-signalen zijn; laag bij ambigue of puur informatief.
- Bij ambigue sentiment of puur informatieve e-mails: classificeer als neutraal (score ≈ 0) met lage confidence.
- Als alleen onderwerp beschikbaar is: gebruik onderwerp en context voor zover mogelijk; geef lage confidence.

Per e-mail: score (-1.0 tot 1.0), isEscalation (urgentie/klacht/juridische dreiging), explanation (1 zin Nederlands), optioneel confidence (0-1).
overallExplanation: korte samenvatting (1-2 zinnen) van het algemene sentiment.

Antwoord ALLEEN met geldige JSON (zelfde volgorde als de e-mails):
{"overallExplanation": "...", "results": [{"score": 0.5, "isEscalation": false, "explanation": "...", "confidence": 0.8}, ...]}`;

export async function scoreEmailsWithGroq(
  emails: Array<{ id: string; snippet: string; subject: string; date: string }>
): Promise<{ scored: ScoredEmail[]; details: SentimentDetails }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const items = emails
    .map((e, i) => {
      const subject = (e.subject ?? "").slice(0, 100);
      const body = (e.snippet ?? "").slice(0, 900).trim();
      const content = body || "(alleen onderwerp beschikbaar)";
      return `[${i + 1}] Onderwerp: ${subject}\nInhoud: ${content}`;
    })
    .join("\n\n");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: `E-mails:\n\n${items}` },
      ],
      temperature: 0.1,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = (data.choices?.[0]?.message?.content ?? "").trim();

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
    console.warn("[Groq] JSON parse failed, raw:", text.slice(0, 400));
    throw new Error("Groq: JSON parsing failed");
  }

  const results = (parsed.results ?? []).map((r) => ({
      score:
        typeof r.score === "number"
          ? Math.max(-1, Math.min(1, r.score))
          : 0,
      isEscalation: Boolean(r.isEscalation),
      explanation: typeof r.explanation === "string" ? r.explanation : "—",
      confidence:
        typeof r.confidence === "number"
          ? Math.max(0, Math.min(1, r.confidence))
          : undefined,
    }));

    const scored: ScoredEmail[] = emails.map((e, i) => ({
      messageId: e.id,
      snippet: e.snippet,
      subject: e.subject,
      date: e.date,
      score: results[i]?.score ?? 0,
      isEscalation: results[i]?.isEscalation ?? false,
    }));

    const details: SentimentDetails = {
      overallExplanation: parsed.overallExplanation ?? "Geen uitleg beschikbaar.",
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
