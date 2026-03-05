/**
 * GA4 metric catalog for the metric picker UI (Phase 5).
 * Keys are GA4 API metric names.
 */
export const GA4_METRIC_CATALOG = {
  "Sessions & Traffic": [
    { key: "sessions", label: "Sessions", description: "Total number of sessions" },
    { key: "screenPageViews", label: "Page Views", description: "Total page/screen views" },
    { key: "bounceRate", label: "Bounce Rate", description: "% of sessions with no engagement" },
    {
      key: "averageSessionDuration",
      label: "Avg. Session Duration",
      description: "Mean session length in seconds",
    },
    {
      key: "engagementRate",
      label: "Engagement Rate",
      description: "% of engaged sessions",
    },
  ],
  Users: [
    {
      key: "activeUsers",
      label: "Active Users",
      description: "Users with at least one session",
    },
    { key: "newUsers", label: "New Users", description: "First-time users in period" },
    {
      key: "returningUsers",
      label: "Returning Users",
      description: "Users with prior sessions",
    },
  ],
  Conversions: [
    {
      key: "conversions",
      label: "Total Conversions",
      description: "All conversion events",
    },
    {
      key: "sessionConversionRate",
      label: "Session Conversion Rate",
      description: "% sessions with a conversion",
    },
    {
      key: "purchaseRevenue",
      label: "Purchase Revenue",
      description: "Total revenue from purchases",
    },
    {
      key: "transactions",
      label: "Transactions",
      description: "Number of purchase transactions",
    },
  ],
  Engagement: [
    {
      key: "userEngagementDuration",
      label: "Engaged Time",
      description: "Total engaged time (seconds)",
    },
    {
      key: "engagedSessions",
      label: "Engaged Sessions",
      description: "Sessions with engagement >= 10s",
    },
    {
      key: "eventsPerSession",
      label: "Events/Session",
      description: "Average events per session",
    },
  ],
} as const;

export type GA4MetricKey = (typeof GA4_METRIC_CATALOG)[keyof typeof GA4_METRIC_CATALOG][number]["key"];
