/**
 * Robust JSON extraction from AI responses that may contain markdown, preambles, or minor syntax issues.
 */
export function parseAiJson<T>(raw: string): T | null {
  let s = raw.trim();
  if (!s) return null;

  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!s) return null;

  const candidates = [
    s,
    extractJsonObject(s),
    s.replace(/\n+/g, " "),
    extractJsonObject(s.replace(/\n+/g, " ")),
  ].filter((x): x is string => !!x);

  for (const attempt of candidates) {
    try {
      const fixed = attempt.replace(/,(\s*[}\]])/g, "$1");
      const result = JSON.parse(fixed) as T;
      if (result != null && typeof result === "object") return result;
    } catch {
      /* try next */
    }
  }
  return null;
}

function extractJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}
