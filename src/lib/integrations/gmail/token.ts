import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";

export async function getValidGmailToken(clientId: string): Promise<string | null> {
  const connection = await prisma.gmailConnection.findUnique({
    where: { clientId },
  });
  if (!connection || !connection.isValid) return null;

  let accessToken = decrypt(connection.accessToken);
  const refreshToken = decrypt(connection.refreshToken);
  const expiresAt = connection.tokenExpiresAt.getTime();

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

      const updateData: {
        accessToken: string;
        tokenExpiresAt: Date;
        lastRefreshedAt: Date;
        isValid: boolean;
        emailAddress?: string;
      } = {
        accessToken: encrypt(accessToken),
        tokenExpiresAt: newExpiry,
        lastRefreshedAt: new Date(),
        isValid: true,
      };

      if (connection.emailAddress === "unknown") {
        try {
          const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (res.ok) {
            const data = (await res.json()) as { email?: string };
            if (data.email) updateData.emailAddress = data.email;
          }
          if (!updateData.emailAddress) {
            const gmail = google.gmail({ version: "v1", auth: oauth2 });
            const { data } = await gmail.users.getProfile({ userId: "me" });
            if (data.emailAddress) updateData.emailAddress = data.emailAddress;
          }
        } catch {
          /* ignore */
        }
      }

      await prisma.gmailConnection.update({
        where: { id: connection.id },
        data: updateData,
      });
    } catch (err) {
      console.error("[Gmail] Token refresh failed:", err);
      await prisma.gmailConnection.update({
        where: { id: connection.id },
        data: { isValid: false },
      });
      return null;
    }
  }

  return accessToken;
}
