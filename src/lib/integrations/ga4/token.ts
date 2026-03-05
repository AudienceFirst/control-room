import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";

export async function getValidGa4Token(): Promise<string | null> {
  const connection = await prisma.ga4Connection.findFirst();
  if (!connection) return null;

  let accessToken = decrypt(connection.accessToken);
  const refreshToken = decrypt(connection.refreshToken);
  const expiresAt = connection.tokenExpiresAt.getTime();

  // Refresh if expired or expiring in < 5 min
  if (Date.now() >= expiresAt - 5 * 60 * 1000) {
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2.setCredentials({ refresh_token: refreshToken });

    try {
      const { credentials } = await oauth2.refreshAccessToken();
      accessToken = credentials.access_token!;
      const newExpiry = credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : new Date(Date.now() + 3600 * 1000);

      await prisma.ga4Connection.update({
        where: { id: connection.id },
        data: {
          accessToken: encrypt(accessToken),
          tokenExpiresAt: newExpiry,
          lastRefreshedAt: new Date(),
        },
      });
    } catch (err) {
      console.error("[GA4] Token refresh failed:", err);
      return null;
    }
  }

  return accessToken;
}
