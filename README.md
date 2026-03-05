# ZUID Control Room

Multi-client monitoring dashboard that aggregates data from HubSpot, GA4, Gmail, and ClickUp.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS 4
- Prisma + PostgreSQL
- NextAuth.js (Google OAuth)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — Generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — From [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
- `HUBSPOT_CLIENT_ID` / `HUBSPOT_CLIENT_SECRET` — From [HubSpot Developer](https://developers.hubspot.com/)
- `ENCRYPTION_KEY` — Generate with `openssl rand -hex 32` (for OAuth token storage)
- `AUTH_ALLOWED_DOMAIN` — Email domain restriction (default: `zuid.com`)

**HubSpot:** Add this redirect URL in your HubSpot app auth settings:
`http://localhost:3001/api/integrations/hubspot/callback`

### 3. Database

```bash
npx prisma db push
# or for migrations: npx prisma migrate dev
```

### 4. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | ✅ Complete | Foundation: Prisma, NextAuth, Client CRUD, Sidebar |
| **Phase 2** | ✅ Complete | ClickUp Integration: folder discovery, task summary, Control Room cards |
| **Phase 3** | ✅ Complete | HubSpot OAuth: Connect portal, token refresh, status badges |
| Phase 3 | Pending | HubSpot OAuth |
| Phase 4 | Pending | GA4 Integration |
| Phase 5 | Pending | Metric Configuration UI |
| Phase 6 | Pending | Gmail Sentiment |
| Phase 7 | Pending | Control Room Dashboard |
| Phase 8 | Pending | Polish & Production Hardening |

See `TECHNICAL_SPECIFICATION.md` for full details.
