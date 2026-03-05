"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getGmailConnectUrl, disconnectGmail } from "@/app/actions/gmail-oauth";
import { refreshSentiment, updateGmailConfig, testGmailEmailFetch } from "@/app/actions/sentiment";

interface SentimentDetails {
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

interface GmailConfigFormProps {
  clientId: string;
  connection: {
    id: string;
    emailAddress: string;
    filterSenders: string;
    lookbackDays: number;
    isValid: boolean;
    lastRefreshedAt: Date;
  } | null;
  sentiment: {
    overallScore: number;
    trend: string;
    emailsAnalyzed: number;
    lastEmailAt: Date | null;
    hasEscalation: boolean;
    escalationSnippet: string | null;
    detailsJson: string | null;
    analyzedAt: Date;
  } | null;
}

function parseSenders(json: string): string[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function parseDetails(json: string | null): SentimentDetails | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as SentimentDetails;
    if (d && typeof d.overallExplanation === "string" && Array.isArray(d.emailDetails))
      return d;
  } catch {
    /* ignore */
  }
  return null;
}

function SentimentDetailsBlock({
  sentiment,
  scoreEmoji,
}: {
  sentiment: GmailConfigFormProps["sentiment"] & { detailsJson: string | null };
  scoreEmoji: string;
}) {
  const [overallOpen, setOverallOpen] = useState(false);
  const [emailSectionOpen, setEmailSectionOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState<number | null>(null);
  const details = parseDetails(sentiment!.detailsJson);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-zinc-700/80 bg-zinc-900/50 p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{scoreEmoji}</span>
          <div className="flex-1">
            <p className="font-medium text-white">
              Score: {sentiment!.overallScore.toFixed(2)} ·{" "}
              {sentiment!.emailsAnalyzed} e-mails
            </p>
            <p className="text-xs text-zinc-500">
              Trend: {sentiment!.trend} · Laatste:{" "}
              {sentiment!.lastEmailAt
                ? new Date(sentiment!.lastEmailAt).toLocaleDateString("nl-NL")
                : "—"}
            </p>
            {sentiment!.hasEscalation && (
              <p className="mt-2 text-xs text-amber-400">
                ⚠ Escalatie: {sentiment!.escalationSnippet}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2 border-t border-zinc-700/80 pt-4">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOverallOpen((v) => !v);
            }}
            className="flex w-full items-center justify-between rounded-lg bg-zinc-800/60 px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-700/60"
            aria-expanded={overallOpen}
          >
            <span className="font-medium">Uitleg algemeen sentiment</span>
            <svg
              className={`h-4 w-4 shrink-0 transition-transform ${overallOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {overallOpen && (
            <div className="rounded-lg bg-zinc-800/40 px-3 py-2.5 text-sm text-zinc-300">
              {details?.overallExplanation ?? "Geen uitleg beschikbaar. Klik op 'Vernieuw sentiment' om opnieuw te analyseren met Gemini."}
            </div>
          )}

          <div className="mt-2">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setEmailSectionOpen((v) => !v);
              }}
              className="flex w-full items-center justify-between rounded-lg bg-zinc-800/60 px-3 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-zinc-700/60"
              aria-expanded={emailSectionOpen}
            >
              <span className="font-medium">
                Per e-mail {details ? `(${details.emailDetails.length})` : ""}
              </span>
              <svg
                className={`h-4 w-4 shrink-0 transition-transform ${emailSectionOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {emailSectionOpen && (
              <div className="mt-2 space-y-1">
                {details && details.emailDetails.length > 0 ? (
                  details.emailDetails.map((e, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={(eve) => {
                          eve.preventDefault();
                          eve.stopPropagation();
                          setEmailOpen((v) => (v === i ? null : i));
                        }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-zinc-700/40"
                        aria-expanded={emailOpen === i}
                      >
                        <span className="truncate text-zinc-300">
                          {(e.subject || "(Geen onderwerp)").slice(0, 50)}
                          {(e.subject?.length ?? 0) > 50 ? "…" : ""}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {e.score >= 0 ? "+" : ""}{e.score.toFixed(2)}
                          {e.isEscalation && " ⚠"}
                        </span>
                        <svg
                          className={`h-4 w-4 shrink-0 transition-transform ${emailOpen === i ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {emailOpen === i && (
                        <div className="border-t border-zinc-700/60 px-3 py-2.5 text-sm text-zinc-400">
                          <p className="font-medium text-zinc-300">{e.explanation}</p>
                          {e.confidence != null && (
                            <p className="mt-1 text-xs text-zinc-500">
                              Zekerheid: {Math.round(e.confidence * 100)}%
                            </p>
                          )}
                          {e.snippet && (
                            <p className="mt-2 text-xs text-zinc-500 line-clamp-2">
                              {e.snippet}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-zinc-600">
                            {new Date(e.date).toLocaleDateString("nl-NL")}
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg bg-zinc-800/40 px-3 py-2.5 text-sm text-zinc-500">
                    Geen per-e-mail uitleg. Klik op 'Vernieuw sentiment' om met Gemini te analyseren.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GmailConfigForm({
  clientId,
  connection,
  sentiment,
}: GmailConfigFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    steps?: Array<{ query: string; count: number }>;
    error?: string;
    sampleFrom?: string;
  } | null>(null);
  const [filterInput, setFilterInput] = useState("");
  const [senders, setSenders] = useState<string[]>(
    connection ? parseSenders(connection.filterSenders) : []
  );

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testGmailEmailFetch(clientId);
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : "Test mislukt" });
    } finally {
      setTesting(false);
    }
  }

  async function handleConnect() {
    setLoading(true);
    try {
      const url = await getGmailConnectUrl(clientId);
      window.location.href = url;
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (
      !confirm("Gmail ontkoppelen? Sentiment-data wordt verwijderd.")
    )
      return;
    setLoading(true);
    try {
      await disconnectGmail(clientId);
      window.location.reload();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await refreshSentiment(clientId);
      if (!result.success) {
        alert(result.error);
      } else {
        if (result.allSnippetsEmpty) {
          alert(
            "Geen e-mailinhoud gevonden — alle fragmenten zijn leeg.\n\n" +
              "Mogelijke oorzaken:\n" +
              "• Ontkoppel Gmail en verbind opnieuw (scope gmail.readonly nodig)\n" +
              "• E-mails bevatten mogelijk alleen bijlagen, geen tekst\n" +
              "• Filter op afzenders controleert geen e-mails in het venster"
          );
        }
        if (result.geminiError) {
          let msg = result.geminiError;
          try {
            const parsed = JSON.parse(msg) as { error?: { message?: string } };
            if (parsed?.error?.message) msg = parsed.error.message;
          } catch {
            /* use raw */
          }
          const isQuota = /429|rate limit|quota|billing|exceeded/i.test(msg);
          const hint = isQuota
            ? "Voeg GROQ_API_KEY toe (console.groq.com, ~30 rpm free) of wacht tot limiet reset."
            : "Voeg GROQ_API_KEY of GEMINI_API_KEY toe in .env en herstart de server.";
          alert(
            `Gemini-analyse mislukt: ${msg}\n\nKeyword-scores gebruikt. ${hint}`
          );
        }
        router.refresh();
      }
    } finally {
      setRefreshing(false);
    }
  }

  function addSender() {
    const v = filterInput.trim();
    if (!v || senders.includes(v)) return;
    setSenders([...senders, v]);
    setFilterInput("");
    updateGmailConfig(clientId, {
      filterSenders: [...senders, v],
    });
  }

  function removeSender(s: string) {
    const next = senders.filter((x) => x !== s);
    setSenders(next);
    updateGmailConfig(clientId, { filterSenders: next });
  }

  const scoreEmoji =
    sentiment == null
      ? "—"
      : sentiment.overallScore > 0.5
        ? "😊"
        : sentiment.overallScore > 0.2
          ? "🙂"
          : sentiment.overallScore > -0.2
            ? "😐"
            : sentiment.overallScore > -0.5
              ? "😕"
              : "😟";

  return (
    <div className="rounded-xl border border-zinc-700/80 bg-zinc-800/40 p-6">
      <h3 className="mb-4 text-lg font-medium text-white">
        Gmail Sentiment
      </h3>

      {connection ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                connection.isValid
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {connection.isValid ? "● Verbonden" : "○ Fout — opnieuw verbinden"}
            </span>
            <span className="text-sm text-zinc-400">
              {connection.emailAddress === "unknown"
                ? "E-mail onbekend — ontkoppel en verbind opnieuw om adres te tonen"
                : connection.emailAddress}
            </span>
          </div>

          <p className="mt-2 text-xs text-zinc-500">
            Laatst vernieuwd:{" "}
            {new Date(connection.lastRefreshedAt).toLocaleString("nl-NL")}
          </p>

            {testResult && (
              <div className="mb-4 rounded-lg border border-zinc-600 bg-zinc-900/50 p-4 text-sm">
                <p className="mb-2 font-medium text-zinc-300">
                  {testResult.ok ? "Test geslaagd" : "Test mislukt"}
                </p>
                {testResult.error && (
                  <p className="mb-2 text-red-400">{testResult.error}</p>
                )}
                {testResult.steps?.map((s, i) => (
                  <p key={i} className="text-zinc-400">
                    Query <code className="rounded bg-zinc-800 px-1">{s.query}</code> → {s.count} berichten
                  </p>
                ))}
                {testResult.sampleFrom && (
                  <p className="mt-2 text-zinc-400">
                    Voorbeeld From: <span className="text-zinc-300">{testResult.sampleFrom}</span>
                  </p>
                )}
              </div>
            )}

            <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300">
                Filter afzenders (van de klant)
              </label>
              <p className="mb-1 text-xs text-zinc-500">
                Alleen e-mails die de klant verstuurt — niet e-mails die jullie naar de klant sturen
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={filterInput}
                  onChange={(e) => setFilterInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSender())}
                  placeholder="contact@klant.nl of @klant.nl (adres van de klant)"
                  className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <button
                  type="button"
                  onClick={addSender}
                  className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
                >
                  + Toevoegen
                </button>
              </div>
              {senders.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {senders.map((s) => (
                    <li
                      key={s}
                      className="flex items-center gap-1 rounded bg-zinc-700/80 px-2 py-1 text-xs text-zinc-300"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => removeSender(s)}
                        className="text-zinc-500 hover:text-white"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {sentiment && (
              <SentimentDetailsBlock sentiment={sentiment} scoreEmoji={scoreEmoji} />
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {testing ? "Testen…" : "Test e-mail ophalen"}
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || senders.length === 0}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50"
              >
                {refreshing ? "Analyseren…" : "Sentiment vernieuwen"}
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                Ontkoppelen
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-zinc-400">
            Verbind een Gmail-account om e-mailcommunicatie met de klant te
            analyseren op sentiment. Gebruik dezelfde Google-account als voor
            GA4 of een andere mailbox.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Redirecten…" : "Connect Gmail"}
          </button>
        </>
      )}
    </div>
  );
}
