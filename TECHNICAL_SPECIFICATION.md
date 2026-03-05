# ZUID Control Room — Technical Specification

**Version:** 1.0
**Date:** 2026-02-23
**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Shadcn/UI · Prisma · PostgreSQL

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Database Schema](#2-database-schema)
3. [Authentication Architecture](#3-authentication-architecture)
4. [API Integration Architecture](#4-api-integration-architecture)
5. [UI Specification](#5-ui-specification)
6. [Data Refresh & Caching Strategy](#6-data-refresh--caching-strategy)
7. [Gmail Sentiment Analysis](#7-gmail-sentiment-analysis)
8. [Threshold & Alert System](#8-threshold--alert-system)
9. [ClickUp Integration](#9-clickup-integration)
10. [Implementation Roadmap](#10-implementation-roadmap)
11. [Security Considerations](#11-security-considerations)

---

## 1. System Overview

ZUID Control Room is a multi-client monitoring dashboard that aggregates data from HubSpot, GA4, Gmail, and ClickUp into a single control surface. The system has two distinct interaction modes:

**Configuration mode** (Settings pages): Where consultants wire up integrations, define clients, and configure metric thresholds.

**Monitoring mode** (Dashboard/Control Room): A birds-eye scan of all clients showing real-time health indicators, sentiment signals, and task state.

### Architectural Decisions

- **Database:** PostgreSQL via Prisma ORM — required because per-client OAuth tokens, metric configs, and threshold settings must be persisted server-side. The existing JSON-file pattern does not scale to multi-client.
- **Authentication:** NextAuth.js with Google OAuth, restricted to the `@zuid.com` (or configured) domain.
- **Token Storage:** Encrypted at rest in the database. HubSpot and Gmail OAuth refresh tokens are per-client secrets; ClickUp uses a single workspace token from env.
- **Data Layer:** Next.js Server Actions (consistent with existing codebase pattern). No traditional REST API routes.
- **Caching:** React `cache()` + `unstable_cache` for 30-day rolling window data. Per-client cache keys scoped to client ID.

---

## 2. Database Schema

### Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Authentication ───────────────────────────────────────────────────────────

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  role          UserRole  @default(CONSULTANT)
  accounts      Account[]
  sessions      Session[]
  clients       Client[]  @relation("ClientCreatedBy")
  createdAt     DateTime  @default(now())
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

enum UserRole {
  ADMIN
  CONSULTANT
}

// ─── Client Management ────────────────────────────────────────────────────────

model Client {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique  // URL-safe identifier, e.g. "acme-corp"
  logoUrl     String?
  isActive    Boolean  @default(true)
  createdById String
  createdBy   User     @relation("ClientCreatedBy", fields: [createdById], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Integrations
  hubspotConnection   HubSpotConnection?
  gmailConnection     GmailConnection?
  clickupConfig       ClickUpConfig?

  // Configuration
  metricConfigs       MetricConfig[]
  sentimentConfig     SentimentConfig?

  // Cached snapshots (denormalized for dashboard speed)
  latestSnapshot      ClientSnapshot?

  @@index([isActive])
}

// ─── Integration Connections ──────────────────────────────────────────────────

model HubSpotConnection {
  id                String   @id @default(cuid())
  clientId          String   @unique
  client            Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  portalId          String   // HubSpot portal/hub ID
  hubDomain         String?  // e.g. "acme.hubspot.com"
  region            String   @default("us") // "us" | "eu1"

  // OAuth tokens — encrypted at rest (see Security section)
  accessToken       String   @db.Text  // AES-256-GCM encrypted
  refreshToken      String   @db.Text  // AES-256-GCM encrypted
  tokenExpiresAt    DateTime
  scopes            String[] // e.g. ["crm.objects.contacts.read", ...]

  connectedAt       DateTime @default(now())
  lastRefreshedAt   DateTime @default(now())
  isValid           Boolean  @default(true)

  @@index([clientId])
}

model GmailConnection {
  id                String   @id @default(cuid())
  clientId          String   @unique
  client            Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  emailAddress      String   // The Gmail address connected (client contact's mailbox)
  googleAccountId   String   // Google sub/account ID

  // OAuth tokens — encrypted at rest
  accessToken       String   @db.Text
  refreshToken      String   @db.Text
  tokenExpiresAt    DateTime
  scopes            String[]

  // Filter: which senders/labels to analyze
  filterSenders     String[] // e.g. ["client@acme.com", "@acme.com"]
  filterLabels      String[] // Gmail label IDs to monitor
  lookbackDays      Int      @default(30)

  connectedAt       DateTime @default(now())
  lastRefreshedAt   DateTime @default(now())
  isValid           Boolean  @default(true)

  @@index([clientId])
}

model ClickUpConfig {
  id              String   @id @default(cuid())
  clientId        String   @unique
  client          Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  // The top-level client folder ID in ClickUp workspace
  clientFolderId  String

  // Subfolder IDs resolved at config time (can be auto-discovered)
  estimatesFolderId String?
  projectsFolderId  String?
  contactsFolderId  String?

  // Display preferences
  showCompletedDays Int    @default(7)   // Days of completed tasks to surface

  configuredAt    DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([clientId])
}

// ─── Metric Configuration ─────────────────────────────────────────────────────

model MetricConfig {
  id           String     @id @default(cuid())
  clientId     String
  client       Client     @relation(fields: [clientId], references: [id], onDelete: Cascade)

  // Identity
  label        String     // Display name, e.g. "Monthly New Contacts"
  dataSource   DataSource // HUBSPOT | GA4
  metricKey    String     // e.g. "contacts_created" | "ga4:sessions"
  category     String     // e.g. "Contacts" | "Sessions" — for display grouping

  // For GA4: property ID (clients may have different GA4 properties)
  ga4PropertyId String?

  // Threshold configuration (30-day rolling window)
  thresholdLow   Float?   // Alert if value drops below this
  thresholdHigh  Float?   // Alert if value exceeds this
  thresholdUnit  String?  // "count" | "percentage" | "currency" — for formatting

  // Display
  displayOrder Int        @default(0)
  isVisible    Boolean    @default(true)

  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  // Cached current values (refreshed by background job)
  latestValues MetricSnapshot[]

  @@unique([clientId, dataSource, metricKey])
  @@index([clientId, isVisible])
}

enum DataSource {
  HUBSPOT
  GA4
}

model MetricSnapshot {
  id             String       @id @default(cuid())
  metricConfigId String
  metricConfig   MetricConfig @relation(fields: [metricConfigId], references: [id], onDelete: Cascade)

  // The 30-day window this snapshot covers
  windowStart    DateTime
  windowEnd      DateTime
  value          Float
  previousValue  Float?       // Prior 30-day window for delta calculation

  // Alert status at time of snapshot
  alertStatus    AlertStatus  @default(NORMAL)

  capturedAt     DateTime     @default(now())

  @@index([metricConfigId, capturedAt(sort: Desc)])
}

enum AlertStatus {
  NORMAL
  LOW     // Value below thresholdLow
  HIGH    // Value above thresholdHigh
  MISSING // Could not fetch data
}

// ─── Sentiment Configuration ──────────────────────────────────────────────────

model SentimentConfig {
  id            String   @id @default(cuid())
  clientId      String   @unique
  client        Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  isEnabled     Boolean  @default(true)
  analysisMode  SentimentMode @default(KEYWORD)

  // Keyword lists for keyword-based mode
  positiveKeywords String[]
  negativeKeywords String[]
  escalationKeywords String[] // "urgent", "ASAP", "disappointed" — trigger immediate flag

  updatedAt     DateTime @updatedAt
}

enum SentimentMode {
  KEYWORD  // Simple keyword matching
  ML       // ML-based scoring (future: Claude API or Anthropic API)
}

// ─── Dashboard Snapshot (Denormalized Cache) ──────────────────────────────────

// Stores the pre-computed dashboard card data to allow instant page loads.
// Refreshed by background job; never the source of truth.
model ClientSnapshot {
  id              String   @id @default(cuid())
  clientId        String   @unique
  client          Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  // Serialized JSON blobs — typed on read via Zod
  metricsJson     Json     // MetricCardData[]
  sentimentJson   Json     // SentimentSummary
  tasksJson       Json     // TaskSummary
  alertsJson      Json     // Alert[]

  // Overall health score (0–100, computed from alerts)
  healthScore     Int      @default(100)

  capturedAt      DateTime @default(now())
  staleAfter      DateTime // capturedAt + 30 minutes typically

  @@index([staleAfter])
}
```

### Supporting Type Definitions (TypeScript)

```typescript
// src/types/snapshot.ts

export interface MetricCardData {
  metricConfigId: string;
  label: string;
  category: string;
  value: number;
  previousValue: number | null;
  delta: number | null;      // value - previousValue
  deltaPercent: number | null;
  alertStatus: 'NORMAL' | 'LOW' | 'HIGH' | 'MISSING';
  thresholdLow: number | null;
  thresholdHigh: number | null;
  unit: string;
  capturedAt: string;
}

export interface SentimentSummary {
  overallScore: number;      // -1.0 (very negative) to 1.0 (very positive)
  trend: 'IMPROVING' | 'STABLE' | 'DECLINING';
  emailsAnalyzed: number;
  lastEmailAt: string | null;
  hasEscalation: boolean;    // true if escalation keywords found
  escalationSnippet: string | null;  // Preview of escalating email
  analyzedAt: string;
}

export interface TaskSummary {
  incompleteCount: number;
  overdueCount: number;
  recentlyCompletedCount: number;
  estimatesByStatus: StatusCount[];
  projectsByStatus: StatusCount[];
  topIncompleteTasks: TaskItem[];
}

export interface StatusCount {
  status: string;
  count: number;
  color?: string;  // ClickUp status color
}

export interface TaskItem {
  id: string;
  name: string;
  status: string;
  dueDate: string | null;
  isOverdue: boolean;
  assignees: string[];
  listName: string;  // Which subfolder the task lives in
}

export interface Alert {
  id: string;
  clientId: string;
  type: 'METRIC_LOW' | 'METRIC_HIGH' | 'SENTIMENT_NEGATIVE' | 'TASK_OVERDUE' | 'INTEGRATION_ERROR';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  triggeredAt: string;
}
```

---

## 3. Authentication Architecture

### NextAuth Configuration

```typescript
// src/lib/auth/config.ts

import { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

const ALLOWED_DOMAIN = process.env.AUTH_ALLOWED_DOMAIN ?? "zuid.com";

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request offline access for token refresh capability
          access_type: "offline",
          prompt: "consent",
          scope: "openid email profile",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // Hard domain restriction — only @zuid.com addresses
      const email = profile?.email ?? "";
      if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        return false;  // Silently deny; NextAuth shows access denied page
      }
      return true;
    },
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};
```

```typescript
// src/app/auth/signin/page.tsx
// Custom sign-in page — shows Google button with ZUID branding
// Displays "ZUID email addresses only" notice
```

### Middleware — Route Protection

```typescript
// src/middleware.ts

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/auth");

  if (!isAuthenticated && !isAuthPage) {
    return NextResponse.redirect(new URL("/auth/signin", req.url));
  }

  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|public).*)"],
};
```

---

## 4. API Integration Architecture

### 4.1 HubSpot OAuth Integration

HubSpot uses a standard OAuth 2.0 flow. Each client gets their own portal connected.

```
User clicks "Connect HubSpot" on Client Settings page
    ↓
Redirect to HubSpot OAuth consent URL
    ↓
HubSpot redirects to /api/integrations/hubspot/callback?code=...&state=...
    ↓
Server exchanges code for access_token + refresh_token
    ↓
Tokens encrypted and stored in HubSpotConnection table
    ↓
Server validates connection by fetching portal info
    ↓
Redirect back to client settings with success state
```

**Required HubSpot OAuth Scopes:**
```
crm.objects.contacts.read
crm.objects.contacts.write (for future use)
crm.objects.deals.read
crm.objects.companies.read
crm.objects.tickets.read
crm.schemas.contacts.read
crm.schemas.deals.read
oauth
```

**OAuth Callback Handler:**
```typescript
// src/app/api/integrations/hubspot/callback/route.ts

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // clientId encoded

  // 1. Validate state (CSRF protection — stored in session before redirect)
  // 2. Exchange code for tokens via HubSpot token endpoint
  // 3. Encrypt tokens
  // 4. Upsert HubSpotConnection record
  // 5. Redirect to /settings/clients/[clientId]?connected=hubspot
}
```

**Token Refresh — Proactive Strategy:**
```typescript
// src/lib/integrations/hubspot/token.ts

export async function getValidHubSpotToken(clientId: string): Promise<string> {
  const connection = await prisma.hubSpotConnection.findUnique({
    where: { clientId },
  });

  if (!connection || !connection.isValid) {
    throw new IntegrationError("HubSpot not connected", { clientId });
  }

  // Refresh if within 5 minutes of expiry
  const expiresAt = connection.tokenExpiresAt;
  const bufferMs = 5 * 60 * 1000;

  if (Date.now() + bufferMs >= expiresAt.getTime()) {
    return refreshHubSpotToken(connection);
  }

  return decrypt(connection.accessToken);
}

async function refreshHubSpotToken(connection: HubSpotConnection): Promise<string> {
  const response = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.HUBSPOT_CLIENT_ID!,
      client_secret: process.env.HUBSPOT_CLIENT_SECRET!,
      refresh_token: decrypt(connection.refreshToken),
    }),
  });

  if (!response.ok) {
    // Mark connection as invalid — will show warning badge in UI
    await prisma.hubSpotConnection.update({
      where: { id: connection.id },
      data: { isValid: false },
    });
    throw new IntegrationError("HubSpot token refresh failed");
  }

  const tokens = await response.json();

  // Encrypt and persist new tokens
  await prisma.hubSpotConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      lastRefreshedAt: new Date(),
      isValid: true,
    },
  });

  return tokens.access_token;
}
```

### 4.2 GA4 Integration

GA4 uses the existing Google OAuth flow (piggybacks on GOOGLE_CLIENT_ID/SECRET). However, for per-client GA4 access, ZUID staff need viewer access to the client's GA4 property — or the client's Google account is connected via OAuth (similar to HubSpot flow).

**Recommended approach for ZUID context:** Service Account with property-level access.

```typescript
// src/lib/integrations/ga4/client.ts

import { BetaAnalyticsDataClient } from "@google-analytics/data";

// Zuid service account has been granted Viewer access to each client GA4 property
const analyticsClient = new BetaAnalyticsDataClient({
  keyFilename: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
});

export async function fetchGA4Metric({
  propertyId,
  metricName,
  startDate,
  endDate,
}: {
  propertyId: string;
  metricName: string;
  startDate: string;  // "2025-01-01"
  endDate: string;    // "today"
}): Promise<number> {
  const [response] = await analyticsClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [{ name: metricName }],
  });

  return Number(response.rows?.[0]?.metricValues?.[0]?.value ?? 0);
}
```

**GA4 Metric Catalog** (organized by grouping for the metric picker UI):

```typescript
// src/config/ga4MetricCatalog.ts

export const GA4_METRIC_CATALOG = {
  "Sessions & Traffic": [
    { key: "sessions", label: "Sessions", description: "Total number of sessions" },
    { key: "screenPageViews", label: "Page Views", description: "Total page/screen views" },
    { key: "bounceRate", label: "Bounce Rate", description: "% of sessions with no engagement" },
    { key: "averageSessionDuration", label: "Avg. Session Duration", description: "Mean session length in seconds" },
    { key: "engagementRate", label: "Engagement Rate", description: "% of engaged sessions" },
  ],
  "Users": [
    { key: "activeUsers", label: "Active Users", description: "Users with at least one session" },
    { key: "newUsers", label: "New Users", description: "First-time users in period" },
    { key: "returningUsers", label: "Returning Users", description: "Users with prior sessions" },
    { key: "dauPerMau", label: "DAU/MAU Ratio", description: "Daily active / monthly active stickiness" },
  ],
  "Conversions": [
    { key: "conversions", label: "Total Conversions", description: "All conversion events" },
    { key: "sessionConversionRate", label: "Session Conversion Rate", description: "% sessions with a conversion" },
    { key: "purchaseRevenue", label: "Purchase Revenue", description: "Total revenue from purchases" },
    { key: "transactions", label: "Transactions", description: "Number of purchase transactions" },
  ],
  "Engagement": [
    { key: "userEngagementDuration", label: "Engaged Time", description: "Total engaged time (seconds)" },
    { key: "engagedSessions", label: "Engaged Sessions", description: "Sessions with engagement >= 10s" },
    { key: "eventsPerSession", label: "Events/Session", description: "Average events per session" },
    { key: "scrolledUsers", label: "Scrolled Users", description: "Users who scrolled 90%+ of page" },
  ],
  "Acquisition": [
    { key: "sessionsPerUser", label: "Sessions/User", description: "Average sessions per user" },
    { key: "organicGoogleSearchClickThroughRate", label: "Organic CTR", description: "Search click-through rate" },
    { key: "organicGoogleSearchImpressions", label: "Search Impressions", description: "Organic search impressions" },
  ],
} as const;
```

### 4.3 Gmail Integration (Per-Client)

Gmail connections allow the dashboard to read email threads between ZUID consultants and the client, scoring overall communication sentiment.

**OAuth Flow:** Similar to HubSpot — client-specific connection. The connected mailbox is typically the Zuid consultant's Gmail account, filtered by the client's email domain.

**Required Scopes:**
```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.metadata
```

```typescript
// src/lib/integrations/gmail/client.ts

import { google } from "googleapis";

export async function fetchClientEmailThreads({
  accessToken,
  filterSenders,
  lookbackDays = 30,
  maxMessages = 100,
}: {
  accessToken: string;
  filterSenders: string[];
  lookbackDays: number;
  maxMessages: number;
}) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: "v1", auth });

  // Build query: messages from/to client domain within lookback window
  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - lookbackDays);
  const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

  const senderQuery = filterSenders
    .map((s) => `from:${s} OR to:${s}`)
    .join(" OR ");

  const query = `(${senderQuery}) after:${afterTimestamp}`;

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: maxMessages,
  });

  const messageIds = listResponse.data.messages?.map((m) => m.id!) ?? [];

  // Fetch snippet + headers for each message (metadata only — minimal data)
  const messages = await Promise.all(
    messageIds.map((id) =>
      gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
        fields: "id,snippet,internalDate,payload/headers",
      })
    )
  );

  return messages.map((m) => m.data);
}
```

**Token Refresh:** Uses the same `GmailConnection` table with encrypted refresh tokens, identical refresh logic to HubSpot.

### 4.4 ClickUp Integration

ClickUp uses a single workspace token (`CLICKUP_API_TOKEN`) — no per-client OAuth needed since ZUID manages the workspace.

```typescript
// src/lib/integrations/clickup/client.ts

const CLICKUP_BASE = "https://api.clickup.com/api/v2";
const CLICKUP_TOKEN = process.env.CLICKUP_API_TOKEN!;

async function clickupFetch(path: string) {
  const res = await fetch(`${CLICKUP_BASE}${path}`, {
    headers: { Authorization: CLICKUP_TOKEN },
    next: { revalidate: 300 }, // 5 min cache
  });

  if (!res.ok) throw new Error(`ClickUp API error: ${res.status}`);
  return res.json();
}

export async function getClientFolderContents(clientFolderId: string) {
  // Fetch all lists (subfolders) in client folder
  const { lists } = await clickupFetch(`/folder/${clientFolderId}/list`);

  // Categorize by naming convention: *clients, *estimates, *projects
  const estimatesList = lists.find((l: any) =>
    l.name.toLowerCase().includes("estimate")
  );
  const projectsList = lists.find((l: any) =>
    l.name.toLowerCase().includes("project")
  );

  return { estimatesList, projectsList, allLists: lists };
}

export async function getIncompleteTasks(listId: string): Promise<TaskItem[]> {
  const { tasks } = await clickupFetch(
    `/list/${listId}/task?include_closed=false&archived=false`
  );
  return tasks;
}

export async function getRecentlyCompletedTasks(
  listId: string,
  days: number = 7
): Promise<TaskItem[]> {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  const { tasks } = await clickupFetch(
    `/list/${listId}/task?statuses[]=complete&date_updated_gt=${since}&archived=false`
  );
  return tasks;
}

export async function getTaskCountsByStatus(listId: string): Promise<StatusCount[]> {
  // Fetch all non-archived tasks with their statuses for count aggregation
  const { tasks } = await clickupFetch(
    `/list/${listId}/task?include_closed=true&archived=false`
  );

  const counts: Record<string, { count: number; color: string }> = {};
  for (const task of tasks) {
    const status = task.status.status;
    if (!counts[status]) {
      counts[status] = { count: 0, color: task.status.color };
    }
    counts[status].count++;
  }

  return Object.entries(counts).map(([status, { count, color }]) => ({
    status,
    count,
    color,
  }));
}
```

---

## 5. UI Specification

### 5.1 Navigation Structure

```
/                           → Redirect to /control-room
/control-room               → Main dashboard (all clients overview)
/control-room/[clientSlug]  → Single client detail view (future)
/settings/                  → Settings home
/settings/clients           → Client list management
/settings/clients/new       → Add new client
/settings/clients/[id]      → Client settings (integrations + metrics)
/settings/clients/[id]/metrics → Metric configuration
/auth/signin                → Login page
/auth/error                 → Auth error page
```

**Sidebar additions** (extends existing Sidebar.tsx):
```
[Sparkles] ZUIDUID Control Room
─────────────────────────────
  Control Room    [grid icon]
─────────────────────────────
  Marketing       [bar chart]
  Sales           [briefcase]
─────────────────────────────
  Settings        [sliders]
```

---

### 5.2 Client Settings Page

**Route:** `/settings/clients/[id]`

This page is the configuration hub for a single client. It uses a tabbed interface.

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Clients                                               │
│                                                                 │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ [Avatar] Acme Corp                    [isActive toggle]  │   │
│ │ Created Feb 23, 2026 by Ruben W.                         │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│ ┌─────────────┬──────────────┬───────────┬───────────────┐     │
│ │  General    │  Integrations│  Metrics  │  Sentiment    │     │
│ └─────────────┴──────────────┴───────────┴───────────────┘     │
│                                                                 │
│ ─── INTEGRATIONS TAB ───────────────────────────────────────   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ HubSpot CRM                          [● Connected]      │   │
│  │ Portal: acme.hubspot.com (EU)                           │   │
│  │ Last refreshed: 2 min ago            [Disconnect] [↻]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Google Analytics 4                   [○ Not connected]  │   │
│  │ GA4 Property ID  [UA-XXXXXXXXX-X          ]             │   │
│  │ (ZUID service account must have Viewer access)          │   │
│  │                                      [Verify Access]    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Gmail (Sentiment Analysis)           [○ Not connected]  │   │
│  │ Connect a Gmail mailbox to analyze communication tone   │   │
│  │ Filter senders: [@acme.com           ] [+ Add domain]   │   │
│  │                                 [Connect Gmail Account] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ClickUp Tasks                        [● Configured]     │   │
│  │ Client Folder ID [folder_abc123      ]                  │   │
│  │ ✓ Estimates list found: "* Estimates" (24 tasks)        │   │
│  │ ✓ Projects list found: "* Projects" (8 tasks)           │   │
│  │                              [Verify] [Save Changes]    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Integration Status Badge Logic:**
- `● Connected` (green) — token valid, last refresh < 1 hour
- `◐ Expiring` (yellow) — token valid, last refresh > 6 hours
- `○ Error` (red) — `isValid: false` in DB, requires reconnection
- `○ Not connected` (gray) — no record in DB

---

### 5.3 Metric Configuration Interface

**Route:** `/settings/clients/[id]/metrics`

The metric configuration UI must handle both HubSpot (object-based hierarchy) and GA4 (grouped metrics) in a single coherent interface.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Metrics for Acme Corp                                    [+ Add Metric]       │
│                                                                                │
│  ─ Configured Metrics ──────────────────────────────────────────────────────  │
│                                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ ≡  Monthly New Contacts      [HubSpot · Contacts]    NORMAL  ⋮         │   │
│  │    30-day avg: 47   Low: 20   High: —                                  │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │ ≡  Open Deals Value          [HubSpot · Deals]       ⚠ LOW   ⋮         │   │
│  │    30-day avg: €12,400   Low: €25,000   High: —                        │   │
│  ├────────────────────────────────────────────────────────────────────────┤   │
│  │ ≡  Monthly Sessions          [GA4]                   NORMAL  ⋮         │   │
│  │    30-day avg: 4,820   Low: 3,000   High: 10,000                       │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Add Metric Modal / Slide-over Panel:**

```
┌──────────────────────────────────────────────────┐
│ Add Metric                                    [×] │
│                                                   │
│  Data Source                                      │
│  ┌───────────────────────────┐                   │
│  │ HubSpot CRM          ▾    │                   │
│  └───────────────────────────┘                   │
│                                                   │
│  ─ HubSpot: Select by Object Type ──────────     │
│                                                   │
│  ┌───────────────────────────────────────────┐   │
│  │                                           │   │
│  │  [Contacts]  [Companies]  [Deals]         │   │
│  │  [Tickets ]  [Activities]                 │   │
│  │                                           │   │
│  │  ── Contacts ──────────────────────────   │   │
│  │  ○ New Contacts (created)                 │   │
│  │  ○ Contacts → MQL                         │   │
│  │  ○ Contacts → SQL                         │   │
│  │  ○ Total Contacts                         │   │
│  │  ○ Contacts by Lead Status                │   │
│  │                                           │   │
│  │  ── Deals ──────────────────────────────  │   │
│  │  ○ Open Deals (count)                     │   │
│  │  ● Open Deals (value)          ← selected │   │
│  │  ○ Closed Won (count)                     │   │
│  │  ○ Closed Won (revenue)                   │   │
│  │  ○ Deal Velocity (avg days)               │   │
│  │                                           │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  Label (optional override)                        │
│  ┌───────────────────────────────────────────┐   │
│  │ Open Deals Value                          │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ─ Threshold (30-day rolling window) ──────────   │
│                                                   │
│  Low Alert  ┌──────────┐  High Alert ┌──────────┐ │
│             │ 25000    │             │          │ │
│             └──────────┘             └──────────┘ │
│  Alert when value falls    Alert when value rises  │
│  below this amount         above this amount       │
│  (leave blank to disable)  (leave blank to disable)│
│                                                   │
│              [Cancel]  [Add Metric]               │
└──────────────────────────────────────────────────┘
```

**When GA4 is selected:**
```
│  ─ GA4: Select by Category ──────────────────    │
│                                                   │
│  [Sessions & Traffic]  [Users]  [Conversions]    │
│  [Engagement]          [Acquisition]             │
│                                                   │
│  ── Sessions & Traffic ────────────────────      │
│  ○ Sessions                                       │
│  ○ Page Views                                     │
│  ● Bounce Rate                    ← selected      │
│  ○ Avg. Session Duration                          │
│  ○ Engagement Rate                                │
```

**HubSpot Metric Catalog:**
```typescript
// src/config/hubspotMetricCatalog.ts

export const HUBSPOT_METRIC_CATALOG = {
  "Contacts": [
    { key: "contacts_created", label: "New Contacts (created)", unit: "count",
      description: "Contacts created in the 30-day window" },
    { key: "contacts_mql", label: "Contacts → MQL", unit: "count",
      description: "Contacts that entered MQL status" },
    { key: "contacts_sql", label: "Contacts → SQL", unit: "count",
      description: "Contacts that entered SQL status" },
    { key: "contacts_total", label: "Total Contacts", unit: "count",
      description: "All contacts in portal" },
    { key: "contacts_by_lead_status", label: "By Lead Status", unit: "count",
      description: "Count of contacts per lead status value" },
  ],
  "Companies": [
    { key: "companies_created", label: "New Companies", unit: "count" },
    { key: "companies_active", label: "Active Companies", unit: "count" },
    { key: "companies_total", label: "Total Companies", unit: "count" },
  ],
  "Deals": [
    { key: "deals_open_count", label: "Open Deals (count)", unit: "count" },
    { key: "deals_open_value", label: "Open Deals (value)", unit: "currency" },
    { key: "deals_won_count", label: "Closed Won (count)", unit: "count" },
    { key: "deals_won_value", label: "Closed Won (revenue)", unit: "currency" },
    { key: "deals_lost_count", label: "Closed Lost (count)", unit: "count" },
    { key: "deals_velocity", label: "Deal Velocity (avg days)", unit: "days" },
    { key: "deals_pipeline_value", label: "Weighted Pipeline", unit: "currency" },
  ],
  "Tickets": [
    { key: "tickets_open", label: "Open Tickets", unit: "count" },
    { key: "tickets_created", label: "New Tickets", unit: "count" },
    { key: "tickets_avg_response_time", label: "Avg. Response Time", unit: "hours" },
  ],
  "Activities": [
    { key: "activities_meetings", label: "Meetings Booked", unit: "count" },
    { key: "activities_calls", label: "Calls Logged", unit: "count" },
    { key: "activities_emails", label: "Emails Sent", unit: "count" },
  ],
} as const;
```

---

### 5.4 Control Room Dashboard

**Route:** `/control-room`

The primary monitoring surface. The goal is to scan all clients in under 30 seconds and identify which ones need attention today.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ZUIDUID Control Room                                    Refresh: 2 min ago ↺ │
│                                                                                │
│  [All Clients ▾]  [Filter: ⚠ Alerts only]  [Sort: Health score ▾]            │
│                                                                                │
│  ─ 3 clients need attention ──────────────────────────────────────────────    │
│                                                                                │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ ⚠ Acme Corp            Score: 61 │  │ ● Bravo BV            Score: 94  │  │
│  │ ─────────────────────────────── │  │ ─────────────────────────────── │  │
│  │ METRICS                         │  │ METRICS                         │  │
│  │ New Contacts    23 ▼ LOW        │  │ Sessions       4,820 ↑ +12%     │  │
│  │ Open Deal Value €8.2k ▼ LOW    │  │ New Contacts     51 → NORMAL    │  │
│  │ Sessions       3,100 → NORMAL  │  │ Deals Won       €34k → NORMAL   │  │
│  │                                 │  │                                 │  │
│  │ SENTIMENT  😟 Declining (-0.3)  │  │ SENTIMENT  😊 Positive (+0.6)   │  │
│  │ "urgent turnaround needed" ⚠   │  │ 18 emails · Last: 1 day ago     │  │
│  │                                 │  │                                 │  │
│  │ TASKS                           │  │ TASKS                           │  │
│  │ ⬛ 3 overdue  □ 12 open        │  │ □ 0 overdue  □ 7 open          │  │
│  │ Estimates: 2 Draft, 1 Sent      │  │ Estimates: 1 Approved           │  │
│  │ Projects: 1 Active              │  │ Projects: 2 Active              │  │
│  └──────────────────────────────────┘  └──────────────────────────────────┘  │
│                                                                                │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ ● Charlie Group        Score: 88 │  │ + Add Client                     │  │
│  │ ─────────────────────────────── │  │                                 │  │
│  │ ...                             │  │                                 │  │
│  └──────────────────────────────────┘  └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Client Card Anatomy:**

```
┌──────────────────────────────────────────────────────────┐
│ [status dot] Client Name                    Score: XX    │ ← Header
│ ──────────────────────────────────────────────────────── │
│                                                          │
│ METRICS                                                  │ ← Section header
│ [metric label]   [value] [delta badge] [alert badge]    │ ← Metric row (repeats)
│ ...                                                      │
│                                                          │
│ SENTIMENT   [emoji] [label] [score]                      │ ← Sentiment row
│ [escalation snippet — only if hasEscalation]             │
│                                                          │
│ TASKS                                                    │ ← Tasks row
│ [overdue chip]  [open chip]                              │
│ Estimates: [status counts]                               │
│ Projects: [status counts]                                │
│                                                          │
│ [▼ Show 3 completed]          [Open in ClickUp ↗]       │ ← Footer
└──────────────────────────────────────────────────────────┘
```

**Color/Status System:**

| State | Dot Color | Score Range | Card Border |
|-------|-----------|-------------|-------------|
| Healthy | Green `●` | 80–100 | Default |
| Warning | Amber `◐` | 50–79 | Amber tint |
| Critical | Red `⚠` | 0–49 | Red tint |
| No data | Gray `○` | — | Dashed |

**Metric Row Alert Badges:**
```
→  NORMAL    (no badge — clean)
▼  LOW       (red badge, down arrow)
▲  HIGH      (amber badge, up arrow)
!  MISSING   (gray badge, dash)
```

**Delta Badges** (on all metrics regardless of threshold):
```
+12% ↑   (green, positive)
-8% ↓    (red, negative)
—        (gray, no change or no previous data)
```

**Sentiment Emoji Scale:**

| Score | Emoji | Label |
|-------|-------|-------|
| > 0.5 | 😊 | Very Positive |
| 0.2 to 0.5 | 🙂 | Positive |
| -0.2 to 0.2 | 😐 | Neutral |
| -0.5 to -0.2 | 😕 | Declining |
| < -0.5 | 😟 | Negative |

Escalation flag: If `hasEscalation: true`, show ⚠ + first 60 chars of `escalationSnippet`.

---

### 5.5 Completed Tasks Accordion

Inside each client card, the completed tasks section is collapsed by default:

```
┌──────────────────────────────────────────────┐
│ ▶ Recently completed (7 days) — 4 tasks      │
└──────────────────────────────────────────────┘

Expanded:
┌──────────────────────────────────────────────┐
│ ▼ Recently completed (7 days) — 4 tasks      │
│ ──────────────────────────────────────────── │
│ ✓ Deliver Q1 report         Projects · Done  │
│ ✓ Social calendar March     Projects · Done  │
│ ✓ Invoice #INV-2024-089    Estimates · Done  │
│ ✓ Kickoff call prep         Projects · Done  │
└──────────────────────────────────────────────┘
```

Uses the existing `accordion.tsx` Shadcn component. Intentionally minimal — no timestamps or assignees shown here.

---

## 6. Data Refresh & Caching Strategy

### Refresh Tiers

| Data Type | Refresh Frequency | Strategy |
|-----------|------------------|----------|
| Dashboard snapshot (ClientSnapshot) | Every 30 min | Background job + `staleAfter` check |
| Individual metric values | Every 30 min (with snapshot) | Cached in MetricSnapshot |
| ClickUp task counts | Every 5 min | `next: { revalidate: 300 }` on fetch |
| Gmail sentiment | Every 60 min | Triggered by snapshot refresh |
| HubSpot tokens | On-demand (5 min buffer) | Proactive refresh in `getValidHubSpotToken()` |
| GA4 data | Every 30 min (with snapshot) | Cached in MetricSnapshot |

### Background Refresh Job

Use Next.js Route Handlers called by a cron service (Vercel Cron, GitHub Actions, or external ping):

```typescript
// src/app/api/cron/refresh-snapshots/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshClientSnapshot } from "@/lib/snapshot";

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find snapshots that are stale or don't exist
  const staleClients = await prisma.client.findMany({
    where: {
      isActive: true,
      OR: [
        { latestSnapshot: null },
        { latestSnapshot: { staleAfter: { lte: new Date() } } },
      ],
    },
    select: { id: true, name: true },
  });

  // Refresh each client in parallel (with concurrency limit)
  const results = await Promise.allSettled(
    staleClients.map((c) => refreshClientSnapshot(c.id))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ succeeded, failed, total: staleClients.length });
}
```

```typescript
// src/lib/snapshot.ts

export async function refreshClientSnapshot(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      metricConfigs: true,
      hubspotConnection: true,
      gmailConnection: true,
      clickupConfig: true,
      sentimentConfig: true,
    },
  });

  if (!client) throw new Error(`Client ${clientId} not found`);

  // Fetch all data concurrently
  const [metricsData, sentimentData, tasksData] = await Promise.allSettled([
    fetchAllMetrics(client),
    fetchSentiment(client),
    fetchTaskSummary(client),
  ]);

  const metrics = metricsData.status === "fulfilled" ? metricsData.value : [];
  const sentiment = sentimentData.status === "fulfilled" ? sentimentData.value : null;
  const tasks = tasksData.status === "fulfilled" ? tasksData.value : null;

  // Compute health score
  const alerts = computeAlerts(metrics, sentiment, tasks);
  const healthScore = computeHealthScore(alerts);

  // Upsert snapshot
  const refreshedAt = new Date();
  const staleAfter = new Date(refreshedAt.getTime() + 30 * 60 * 1000); // +30 min

  await prisma.clientSnapshot.upsert({
    where: { clientId },
    update: {
      metricsJson: metrics,
      sentimentJson: sentiment,
      tasksJson: tasks,
      alertsJson: alerts,
      healthScore,
      capturedAt: refreshedAt,
      staleAfter,
    },
    create: {
      clientId,
      metricsJson: metrics,
      sentimentJson: sentiment,
      tasksJson: tasks,
      alertsJson: alerts,
      healthScore,
      capturedAt: refreshedAt,
      staleAfter,
    },
  });
}
```

### Dashboard Page Load Strategy

The control room page reads from `ClientSnapshot` records — making page load near-instant:

```typescript
// src/app/(dashboard)/control-room/page.tsx

import { prisma } from "@/lib/db";

export default async function ControlRoomPage() {
  const clients = await prisma.client.findMany({
    where: { isActive: true },
    include: { latestSnapshot: true },
    orderBy: [
      // Clients with alerts first, then by health score ascending (worst first)
      { latestSnapshot: { healthScore: "asc" } },
      { name: "asc" },
    ],
  });

  // If any snapshot is stale, trigger background refresh (fire and forget)
  const staleClientIds = clients
    .filter((c) => !c.latestSnapshot || c.latestSnapshot.staleAfter < new Date())
    .map((c) => c.id);

  if (staleClientIds.length > 0) {
    // Non-blocking — don't await
    fetch(`/api/cron/refresh-snapshots`, {
      headers: { "x-cron-secret": process.env.CRON_SECRET! },
    }).catch(console.error);
  }

  return <ControlRoomGrid clients={clients} />;
}
```

---

## 7. Gmail Sentiment Analysis

### Analysis Pipeline

```
Gmail API (metadata + snippet)
    ↓
Message preprocessing (strip signatures, quotes)
    ↓
Keyword scoring
    ↓
Aggregated score per client
    ↓
Stored in SentimentSummary (ClientSnapshot.sentimentJson)
```

### Keyword-Based Scoring (Phase 1)

Simple, fast, and auditable. Scores each email snippet on a -1 to +1 scale.

```typescript
// src/lib/sentiment/keyword-scorer.ts

const DEFAULT_POSITIVE_KEYWORDS = [
  "great", "excellent", "perfect", "love", "fantastic", "happy",
  "satisfied", "thank you", "appreciate", "impressed", "well done",
  "awesome", "amazing", "excited", "thrilled", "goed", "uitstekend",
  "tevreden", "dankje", "bedankt", "mooi", "fijn",
];

const DEFAULT_NEGATIVE_KEYWORDS = [
  "disappointed", "frustrated", "unhappy", "concern", "issue", "problem",
  "delay", "late", "overdue", "mistake", "wrong", "poor", "terrible",
  "urgent", "escalate", "unacceptable", "teleurgesteld", "probleem",
  "vertraagd", "fout", "slecht",
];

const DEFAULT_ESCALATION_KEYWORDS = [
  "urgent", "asap", "immediately", "unacceptable", "legal", "lawyer",
  "refund", "cancel", "escalate", "complaint", "spoed", "onacceptabel",
];

export interface ScoredEmail {
  messageId: string;
  snippet: string;
  subject: string;
  date: string;
  score: number;        // -1.0 to 1.0
  isEscalation: boolean;
}

export function scoreEmail(
  snippet: string,
  subject: string,
  config: {
    positiveKeywords: string[];
    negativeKeywords: string[];
    escalationKeywords: string[];
  }
): { score: number; isEscalation: boolean } {
  const text = `${subject} ${snippet}`.toLowerCase();

  const positiveMatches = config.positiveKeywords.filter((kw) =>
    text.includes(kw.toLowerCase())
  ).length;

  const negativeMatches = config.negativeKeywords.filter((kw) =>
    text.includes(kw.toLowerCase())
  ).length;

  const isEscalation = config.escalationKeywords.some((kw) =>
    text.includes(kw.toLowerCase())
  );

  // Simple weighted score
  const totalSignals = positiveMatches + negativeMatches;
  if (totalSignals === 0) return { score: 0, isEscalation };

  const score = (positiveMatches - negativeMatches) / Math.max(totalSignals, 3);
  return { score: Math.max(-1, Math.min(1, score)), isEscalation };
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

  // Weight recent emails more heavily (exponential decay)
  const now = Date.now();
  let weightedSum = 0;
  let totalWeight = 0;

  for (const email of scoredEmails) {
    const ageDays = (now - new Date(email.date).getTime()) / (1000 * 60 * 60 * 24);
    const weight = Math.exp(-ageDays / 14); // 14-day half-life
    weightedSum += email.score * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Trend: compare first half vs second half of period
  const midpoint = Math.floor(scoredEmails.length / 2);
  const firstHalfAvg = average(scoredEmails.slice(0, midpoint).map((e) => e.score));
  const secondHalfAvg = average(scoredEmails.slice(midpoint).map((e) => e.score));
  const trend =
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

function average(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
```

### Phase 2 Upgrade Path: Claude API Scoring

When keyword scoring proves insufficient, replace `scoreEmail()` with a Claude API call:

```typescript
// src/lib/sentiment/claude-scorer.ts (future)

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // Uses ANTHROPIC_API_KEY from env

export async function scoreEmailWithClaude(
  snippet: string,
  subject: string,
  clientContext: string  // Brief description of client relationship
): Promise<{ score: number; reasoning: string; isEscalation: boolean }> {
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001", // Fast + cheap for high-volume scoring
    max_tokens: 100,
    messages: [{
      role: "user",
      content: `Score this client email snippet for sentiment in a B2B marketing agency context.
Client context: ${clientContext}
Subject: ${subject}
Snippet: ${snippet}

Respond with JSON only: {"score": <-1.0 to 1.0>, "isEscalation": <boolean>, "reasoning": "<10 words max>"}`,
    }],
  });

  return JSON.parse(message.content[0].type === "text" ? message.content[0].text : "{}");
}
```

---

## 8. Threshold & Alert System

### Health Score Calculation

```typescript
// src/lib/snapshot/health.ts

export function computeHealthScore(alerts: Alert[]): number {
  let score = 100;

  for (const alert of alerts) {
    switch (alert.severity) {
      case "CRITICAL": score -= 25; break;
      case "WARNING":  score -= 10; break;
      case "INFO":     score -= 3;  break;
    }
  }

  return Math.max(0, score);
}

export function computeAlerts(
  metrics: MetricCardData[],
  sentiment: SentimentSummary | null,
  tasks: TaskSummary | null
): Alert[] {
  const alerts: Alert[] = [];

  // Metric threshold alerts
  for (const metric of metrics) {
    if (metric.alertStatus === "LOW") {
      alerts.push({
        id: `metric-low-${metric.metricConfigId}`,
        clientId: "", // filled by caller
        type: "METRIC_LOW",
        severity: "WARNING",
        message: `${metric.label} is below threshold (${formatValue(metric.value, metric.unit)} < ${formatValue(metric.thresholdLow!, metric.unit)})`,
        triggeredAt: new Date().toISOString(),
      });
    }
    if (metric.alertStatus === "HIGH") {
      alerts.push({
        id: `metric-high-${metric.metricConfigId}`,
        clientId: "",
        type: "METRIC_HIGH",
        severity: "INFO", // High is often good — just informational
        message: `${metric.label} exceeds threshold`,
        triggeredAt: new Date().toISOString(),
      });
    }
  }

  // Sentiment alerts
  if (sentiment?.hasEscalation) {
    alerts.push({
      id: "sentiment-escalation",
      clientId: "",
      type: "SENTIMENT_NEGATIVE",
      severity: "CRITICAL",
      message: `Escalation keywords detected in recent emails`,
      triggeredAt: new Date().toISOString(),
    });
  } else if (sentiment && sentiment.overallScore < -0.3) {
    alerts.push({
      id: "sentiment-negative",
      clientId: "",
      type: "SENTIMENT_NEGATIVE",
      severity: "WARNING",
      message: `Client communication sentiment is declining`,
      triggeredAt: new Date().toISOString(),
    });
  }

  // Task overdue alerts
  if (tasks && tasks.overdueCount > 0) {
    alerts.push({
      id: "tasks-overdue",
      clientId: "",
      type: "TASK_OVERDUE",
      severity: tasks.overdueCount >= 3 ? "CRITICAL" : "WARNING",
      message: `${tasks.overdueCount} overdue task${tasks.overdueCount > 1 ? "s" : ""}`,
      triggeredAt: new Date().toISOString(),
    });
  }

  return alerts;
}
```

### 30-Day Rolling Window Logic

```typescript
// src/lib/metrics/rolling-window.ts

export function getRollingWindow(days: number = 30): { start: Date; end: Date } {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const start = new Date(end);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

export function getPreviousWindow(days: number = 30): { start: Date; end: Date } {
  const current = getRollingWindow(days);

  const end = new Date(current.start);
  end.setMilliseconds(-1);

  const start = new Date(end);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  return { start, end };
}

export function evaluateThreshold(
  value: number,
  thresholdLow: number | null,
  thresholdHigh: number | null
): AlertStatus {
  if (thresholdLow !== null && value < thresholdLow) return "LOW";
  if (thresholdHigh !== null && value > thresholdHigh) return "HIGH";
  return "NORMAL";
}
```

---

## 9. ClickUp Integration

### Folder Discovery

When a user saves a ClickUp folder ID, the system auto-discovers the subfolder structure:

```typescript
// src/lib/integrations/clickup/discovery.ts

export async function discoverClientFolderStructure(clientFolderId: string) {
  const { lists } = await clickupFetch(`/folder/${clientFolderId}/list`);

  // ClickUp naming convention: *clients, *estimates, *projects
  const find = (keyword: string) =>
    lists.find((l: any) => l.name.toLowerCase().startsWith(`*${keyword}`)) ??
    lists.find((l: any) => l.name.toLowerCase().includes(keyword));

  return {
    estimatesList: find("estimate"),
    projectsList: find("project"),
    contactsList: find("client"),
    allLists: lists,
    resolvedAt: new Date().toISOString(),
  };
}
```

### Task Status Aggregation

```typescript
// src/lib/integrations/clickup/aggregate.ts

export async function buildTaskSummary(config: ClickUpConfig): Promise<TaskSummary> {
  const [estimatesLists, projectsLists] = await Promise.all([
    config.estimatesFolderId
      ? getIncompleteTasks(config.estimatesFolderId)
      : Promise.resolve([]),
    config.projectsFolderId
      ? getIncompleteTasks(config.projectsFolderId)
      : Promise.resolve([]),
  ]);

  const [recentEstimates, recentProjects] = await Promise.all([
    config.estimatesFolderId
      ? getRecentlyCompletedTasks(config.estimatesFolderId, config.showCompletedDays)
      : Promise.resolve([]),
    config.projectsFolderId
      ? getRecentlyCompletedTasks(config.projectsFolderId, config.showCompletedDays)
      : Promise.resolve([]),
  ]);

  const allIncomplete = [...estimatesLists, ...projectsLists];
  const overdue = allIncomplete.filter(
    (t) => t.due_date && new Date(Number(t.due_date)) < new Date()
  );

  // Map ClickUp task to our TaskItem type
  const mapTask = (t: any, listName: string): TaskItem => ({
    id: t.id,
    name: t.name,
    status: t.status.status,
    dueDate: t.due_date ? new Date(Number(t.due_date)).toISOString() : null,
    isOverdue: t.due_date ? new Date(Number(t.due_date)) < new Date() : false,
    assignees: t.assignees?.map((a: any) => a.username) ?? [],
    listName,
  });

  return {
    incompleteCount: allIncomplete.length,
    overdueCount: overdue.length,
    recentlyCompletedCount: recentEstimates.length + recentProjects.length,
    estimatesByStatus: groupByStatus(estimatesLists),
    projectsByStatus: groupByStatus(projectsLists),
    topIncompleteTasks: [
      ...overdue.slice(0, 3).map((t) => mapTask(t, "projects")),
      ...allIncomplete
        .filter((t) => !overdue.includes(t))
        .slice(0, 5 - Math.min(3, overdue.length))
        .map((t) => mapTask(t, "projects")),
    ],
  };
}

function groupByStatus(tasks: any[]): StatusCount[] {
  const counts: Record<string, { count: number; color: string }> = {};
  for (const task of tasks) {
    const status = task.status.status;
    if (!counts[status]) counts[status] = { count: 0, color: task.status.color ?? "#ccc" };
    counts[status].count++;
  }
  return Object.entries(counts)
    .map(([status, { count, color }]) => ({ status, count, color }))
    .sort((a, b) => b.count - a.count);
}
```

---

## 10. Implementation Roadmap

### Phase 1 — Foundation (Week 1–2)
- [ ] Install and configure Prisma + PostgreSQL
- [ ] Add NextAuth with Google OAuth + domain restriction
- [ ] Build User/Client/Account/Session DB schema
- [ ] Create `/settings/clients` list page and `/settings/clients/new` form
- [ ] Implement basic client CRUD (name, slug, logo)
- [ ] Update Sidebar with new routes

### Phase 2 — ClickUp Integration (Week 2–3)
- [ ] Build `ClickUpConfig` form in client settings
- [ ] Implement folder discovery (`discoverClientFolderStructure`)
- [ ] Build task fetching and `buildTaskSummary`
- [ ] Build tasks section in control room card
- [ ] Test with CLICKUP_API_TOKEN and real workspace

### Phase 3 — HubSpot OAuth (Week 3–4)
- [ ] Register HubSpot OAuth app with required scopes
- [ ] Implement token encryption utilities
- [ ] Build OAuth redirect + callback route
- [ ] Build `HubSpotConnection` UI in client settings
- [ ] Implement `getValidHubSpotToken` with refresh logic
- [ ] Port existing HubSpot metric fetch logic to per-client token system

### Phase 4 — GA4 Integration (Week 4–5)
- [ ] Set up Google Service Account + share with client GA4 properties
- [ ] Build GA4 property ID input in client settings
- [ ] Implement `fetchGA4Metric` with property ID
- [ ] Wire up GA4 metrics to metric config system

### Phase 5 — Metric Configuration UI (Week 5–6)
- [ ] Build metric config page with existing metrics list
- [ ] Build "Add Metric" modal with HubSpot catalog
- [ ] Build GA4 metric picker tab
- [ ] Build threshold input UI
- [ ] Implement `MetricConfig` + `MetricSnapshot` DB persistence

### Phase 6 — Gmail Sentiment (Week 6–7)
- [ ] Build Gmail OAuth flow (per-client, separate from Zuid Google login)
- [ ] Implement `fetchClientEmailThreads`
- [ ] Implement keyword-based `scoreEmail` and `aggregateSentiment`
- [ ] Build sentiment config UI (keyword lists, filter senders)
- [ ] Display sentiment in client cards

### Phase 7 — Control Room Dashboard (Week 7–8)
- [ ] Build `ClientSnapshot` refresh logic
- [ ] Build cron endpoint + configure Vercel Cron
- [ ] Build control room page reading from snapshots
- [ ] Build client card component with all sections
- [ ] Implement health score + alert system
- [ ] Implement filter/sort controls (by alert status, health score)

### Phase 8 — Polish & Production Hardening (Week 8–9)
- [x] Add `isValid` badge + reconnect prompts for broken integrations
- [x] Add manual refresh button on dashboard
- [x] Error boundaries on all client cards
- [x] Rate limiting on cron endpoint
- [x] Token rotation monitoring (alert when all connections healthy)
- [x] Responsive layout testing

---

## 11. Security Considerations

### Token Encryption

All OAuth access and refresh tokens are encrypted before database storage using AES-256-GCM:

```typescript
// src/lib/crypto.ts

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, "hex"); // 32 bytes = 64 hex chars

export function encrypt(plaintext: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex encoded)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}
```

**Generate ENCRYPTION_KEY:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/zuidcontrolroom

# Authentication
NEXTAUTH_URL=https://control-room.zuid.com
NEXTAUTH_SECRET=<32+ random bytes>
AUTH_ALLOWED_DOMAIN=zuid.com

# Google OAuth (for NextAuth + Gmail)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# HubSpot OAuth
HUBSPOT_CLIENT_ID=...
HUBSPOT_CLIENT_SECRET=...

# ClickUp
CLICKUP_API_TOKEN=...
CLICKUP_WORKSPACE_ID=...

# Encryption (for stored tokens)
ENCRYPTION_KEY=<64 hex chars — see above>

# Cron
CRON_SECRET=<random string>

# GA4 (service account path or JSON)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=/path/to/service-account.json
# Or inline JSON:
# GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Optional: Claude API for advanced sentiment
# ANTHROPIC_API_KEY=...
```

### Additional Security Notes

1. **CSRF on OAuth flows:** Store a random `state` parameter in the user's session before redirecting to HubSpot/Gmail OAuth. Validate `state` on callback before exchanging code.

2. **Scoped ClickUp access:** The ClickUp API token has access to the entire workspace. Validate that the folder ID provided by users actually belongs to the expected workspace (`CLICKUP_WORKSPACE_ID`) before storing.

3. **Rate limiting:** HubSpot API has per-portal and per-token limits. The existing `rateLimit.ts` pattern should be extended to be per-clientId to prevent one client's data fetch from blocking others.

4. **Sensitive data in snapshots:** `ClientSnapshot.sentimentJson` may contain email snippets. These are stored in the DB, not in client-side localStorage or cookies. Access is always server-side via authenticated Server Actions.

5. **Role-based access (future):** The `UserRole` enum (`ADMIN` / `CONSULTANT`) is scaffolded. In a future iteration, `ADMIN` users can manage all clients, while `CONSULTANT` role could be scoped to specific clients via a `ClientMember` join table.

---

*End of Specification — ZUIDUID Control Room v1.0*
