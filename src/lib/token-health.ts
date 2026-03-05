import { prisma } from "@/lib/db";
import { getValidHubSpotToken, IntegrationError } from "@/lib/integrations/hubspot/token";
import { getValidGmailToken } from "@/lib/integrations/gmail/token";

export type ConnectionHealth = {
  clientId: string;
  clientName: string;
  hubspot: { connected: boolean; valid: boolean; expiresAt: Date | null; error?: string } | null;
  gmail: { connected: boolean; valid: boolean; expiresAt: Date | null; error?: string } | null;
};

/**
 * Probes all active clients' OAuth tokens and marks invalid ones in the DB.
 * Returns a health report per client.
 */
export async function checkAllTokenHealth(): Promise<{
  healthy: number;
  degraded: number;
  details: ConnectionHealth[];
}> {
  const clients = await prisma.client.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      hubspotConnection: { select: { id: true, isValid: true, tokenExpiresAt: true } },
      gmailConnection: { select: { id: true, isValid: true, tokenExpiresAt: true } },
    },
  });

  const details: ConnectionHealth[] = [];

  for (const client of clients) {
    const entry: ConnectionHealth = {
      clientId: client.id,
      clientName: client.name,
      hubspot: null,
      gmail: null,
    };

    if (client.hubspotConnection) {
      const hs = client.hubspotConnection;
      entry.hubspot = { connected: true, valid: hs.isValid, expiresAt: hs.tokenExpiresAt };

      if (hs.isValid) {
        try {
          await getValidHubSpotToken(client.id);
        } catch (err) {
          const msg = err instanceof IntegrationError ? err.message : String(err);
          entry.hubspot.valid = false;
          entry.hubspot.error = msg;
          console.warn(`[TokenHealth] HubSpot invalid for ${client.name}: ${msg}`);
        }
      }
    }

    if (client.gmailConnection) {
      const gm = client.gmailConnection;
      entry.gmail = { connected: true, valid: gm.isValid, expiresAt: gm.tokenExpiresAt };

      if (gm.isValid) {
        try {
          const token = await getValidGmailToken(client.id);
          if (!token) {
            entry.gmail.valid = false;
            entry.gmail.error = "Token refresh returned null";
          }
        } catch (err) {
          entry.gmail.valid = false;
          entry.gmail.error = err instanceof Error ? err.message : String(err);
          console.warn(`[TokenHealth] Gmail invalid for ${client.name}: ${entry.gmail.error}`);
        }
      }
    }

    details.push(entry);
  }

  const degraded = details.filter((d) =>
    (d.hubspot && !d.hubspot.valid) || (d.gmail && !d.gmail.valid)
  ).length;
  const healthy = details.length - degraded;

  return { healthy, degraded, details };
}
