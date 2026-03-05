import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { refreshHubSpotTokens } from "./oauth";

export class IntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationError";
  }
}

export async function getValidHubSpotToken(clientId: string): Promise<string> {
  const connection = await prisma.hubSpotConnection.findUnique({
    where: { clientId },
  });

  if (!connection || !connection.isValid) {
    throw new IntegrationError("HubSpot not connected");
  }

  const bufferMs = 5 * 60 * 1000;
  const expiresAt = connection.tokenExpiresAt.getTime();

  if (Date.now() + bufferMs >= expiresAt) {
    return refreshAndGetToken(connection);
  }

  return decrypt(connection.accessToken);
}

async function refreshAndGetToken(
  connection: { id: string; clientId: string; accessToken: string; refreshToken: string; tokenExpiresAt: Date }
): Promise<string> {
  const refreshToken = decrypt(connection.refreshToken);

  try {
    const tokens = await refreshHubSpotTokens(refreshToken);
    const accessToken = encrypt(tokens.access_token);
    const newRefresh = encrypt(tokens.refresh_token ?? refreshToken);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.hubSpotConnection.update({
      where: { id: connection.id },
      data: {
        accessToken,
        refreshToken: newRefresh,
        tokenExpiresAt: expiresAt,
        lastRefreshedAt: new Date(),
        isValid: true,
      },
    });

    return tokens.access_token;
  } catch {
    await prisma.hubSpotConnection.update({
      where: { id: connection.id },
      data: { isValid: false },
    });
    throw new IntegrationError("HubSpot token refresh failed");
  }
}

/** Force refresh HubSpot token (e.g. to clear "Expiring soon" in UI). */
export async function forceRefreshHubSpotToken(clientId: string): Promise<void> {
  const connection = await prisma.hubSpotConnection.findUnique({
    where: { clientId },
  });
  if (!connection || !connection.isValid) {
    throw new IntegrationError("HubSpot not connected");
  }
  await refreshAndGetToken({
    id: connection.id,
    clientId: connection.clientId,
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    tokenExpiresAt: connection.tokenExpiresAt,
  });
}
