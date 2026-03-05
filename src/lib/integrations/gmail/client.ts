import { google } from "googleapis";

export interface GmailMessage {
  id: string;
  snippet?: string;
  bodyText?: string;
  internalDate?: string;
  subject?: string;
  from?: string;
}

type Part = {
  mimeType?: string;
  body?: { data?: string };
  parts?: Part[];
};

/** Check mimeType, allowing charset params like "text/plain; charset=utf-8" */
function isMime(mime: string | undefined, prefix: string): boolean {
  return (mime ?? "").toLowerCase().startsWith(prefix);
}

/** Extract plain text from Gmail message payload (simple or multipart, including nested) */
function extractBodyText(payload: Part | null | undefined): string {
  if (!payload) return "";

  const decodeBase64 = (data: string): string => {
    if (!data || typeof data !== "string") return "";
    try {
      return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
    } catch {
      return "";
    }
  };

  const stripHtml = (html: string): string =>
    html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  const scanParts = (parts: Part[] | undefined): string => {
    if (!parts?.length) return "";
    let plain = "";
    let html = "";
    for (const p of parts) {
      const mime = (p.mimeType ?? "").toLowerCase();
      const hasData = typeof p.body?.data === "string" && p.body.data.length > 0;
      if (isMime(mime, "text/plain") && hasData) {
        const decoded = decodeBase64(p.body!.data!);
        if (decoded.trim()) return decoded;
        if (!plain) plain = decoded;
      }
      if (isMime(mime, "text/html") && hasData) {
        html = stripHtml(decodeBase64(p.body!.data!));
      }
      if (p.parts?.length) {
        const nested = scanParts(p.parts);
        if (nested && !plain) plain = nested;
        if (nested && !html) html = nested;
      }
    }
    return plain || html;
  };

  if (typeof payload.body?.data === "string" && payload.body.data.length > 0) {
    const decoded = decodeBase64(payload.body.data);
    if (decoded.trim()) return decoded;
  }
  return scanParts(payload.parts) || "";
}

/** Debug: test Gmail API met stapsgewijze queries */
export async function testGmailFetch(params: {
  accessToken: string;
  filterSenders: string[];
  lookbackDays?: number;
}): Promise<{
  ok: boolean;
  steps: Array<{ query: string; count: number }>;
  error?: string;
  sampleFrom?: string;
}> {
  const { accessToken, filterSenders, lookbackDays = 14 } = params;
  const steps: Array<{ query: string; count: number }> = [];
  const newerThan = `${lookbackDays}d`;

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  try {
    // Stap 1: Alleen datum - werkt de API?
    const q1 = `newer_than:${newerThan}`;
    const r1 = await gmail.users.messages.list({
      userId: "me",
      q: q1,
      maxResults: 10,
    });
    const c1 = r1.data.messages?.length ?? 0;
    steps.push({ query: q1, count: c1 });

    if (filterSenders.length === 0) {
      return { ok: true, steps };
    }

    const pattern = filterSenders[0].startsWith("@")
      ? filterSenders[0].slice(1)
      : filterSenders[0];
    const senderPart = `from:${pattern} OR to:${pattern}`;

    // Stap 2: Met sender + datum
    const q2 = `(${senderPart}) newer_than:${newerThan}`;
    const r2 = await gmail.users.messages.list({
      userId: "me",
      q: q2,
      maxResults: 50,
    });
    const c2 = r2.data.messages?.length ?? 0;
    steps.push({ query: q2, count: c2 });

    // Stap 3: Alleen sender (geen datum)
    const q3 = `(${senderPart})`;
    const r3 = await gmail.users.messages.list({
      userId: "me",
      q: q3,
      maxResults: 50,
    });
    const c3 = r3.data.messages?.length ?? 0;
    steps.push({ query: q3, count: c3 });

    let sampleFrom: string | undefined;
    if (c3 > 0 && r3.data.messages?.[0]?.id) {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: r3.data.messages[0].id!,
        format: "metadata",
        metadataHeaders: ["From", "To", "Subject"],
      });
      const from = msg.data.payload?.headers?.find(
        (h) => h.name?.toLowerCase() === "from"
      )?.value;
      sampleFrom = from ?? undefined;
    }

    return {
      ok: true,
      steps,
      sampleFrom,
    };
  } catch (err) {
    return {
      ok: false,
      steps,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchClientEmailThreads(params: {
  accessToken: string;
  filterSenders: string[];
  lookbackDays?: number;
  maxMessages?: number;
}): Promise<GmailMessage[]> {
  const {
    accessToken,
    filterSenders,
    lookbackDays = 30,
    maxMessages = 100,
  } = params;

  if (filterSenders.length === 0) {
    return [];
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth: oauth2 });

  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - lookbackDays);
  const afterTimestamp = Math.floor(afterDate.getTime() / 1000); // for fallback date filter
  const newerThan = `${lookbackDays}d`;

  // Bredere query (from OR to) om berichten op te halen; daarna filteren we op from
  const senderQuery = filterSenders
    .filter((s) => s.trim().length > 0)
    .map((s) => {
      const pattern = s.startsWith("@") ? s.slice(1) : s;
      return `from:${pattern} OR to:${pattern}`;
    })
    .join(" OR ");

  let messageIds: string[] = [];
  let usedFallback = false;
  let filterByDate = false;
  try {
    const query = `(${senderQuery}) newer_than:${newerThan}`;
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(maxMessages, 100),
    });
    messageIds = listRes.data.messages?.map((m) => m.id!) ?? [];

    if (messageIds.length === 0) {
      filterByDate = true;
      const queryNoDate = `(${senderQuery})`;
      const listRes2 = await gmail.users.messages.list({
        userId: "me",
        q: queryNoDate,
        maxResults: Math.min(maxMessages, 100),
      });
      messageIds = listRes2.data.messages?.map((m) => m.id!) ?? [];
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Metadata scope") && msg.includes("'q'")) {
      usedFallback = true;
      const listRes = await gmail.users.messages.list({
        userId: "me",
        maxResults: 500,
      });
      messageIds = listRes.data.messages?.map((m) => m.id!) ?? [];
    } else {
      throw err;
    }
  }

  if (messageIds.length === 0) return [];

  // Normalize filterSenders for matching: @domain -> *@domain, else exact
  const matchPatterns = filterSenders
    .filter((s) => s.trim().length > 0)
    .map((s) => {
      const p = s.startsWith("@") ? s.slice(1) : s;
      return { raw: s, pattern: s.startsWith("@") ? new RegExp(`@${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i") : new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") };
    });

  function headerMatchesFilter(from?: string, to?: string): boolean {
    const text = [from, to].filter(Boolean).join(" ");
    if (!text) return false;
    for (const { pattern } of matchPatterns) {
      if (pattern.test(text)) return true;
    }
    return false;
  }

  const messages: GmailMessage[] = [];

  for (const id of messageIds) {
    try {
      const msgRes = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "full",
      });

      const payload = msgRes.data.payload;
      const headers = payload?.headers ?? [];
      const getHeader = (name: string): string | undefined => {
        const v = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;
        return v ?? undefined;
      };

      const from = getHeader("From");
      const to = getHeader("To");
      const internalDate = msgRes.data.internalDate ?? undefined;

      if (usedFallback || filterByDate) {
        const ts = internalDate ? parseInt(internalDate, 10) : 0;
        if (ts < afterTimestamp * 1000) continue;
      }
      if (!headerMatchesFilter(from, to)) continue;
      if (messages.length >= maxMessages) break;

      const snippet = msgRes.data.snippet ?? undefined;
      const bodyText = extractBodyText(payload as Part | null);
      const content = (bodyText.trim() || snippet || "").replace(/\s+/g, " ").trim();

      messages.push({
        id: msgRes.data.id!,
        snippet: content.slice(0, 1200),
        bodyText: content,
        internalDate,
        subject: getHeader("Subject"),
        from,
      });
    } catch {
      // Skip failed messages
    }
  }

  // Sort by date descending (newest first)
  messages.sort((a, b) => {
    const aTime = a.internalDate ? parseInt(a.internalDate, 10) : 0;
    const bTime = b.internalDate ? parseInt(b.internalDate, 10) : 0;
    return bTime - aTime;
  });

  return messages;
}
