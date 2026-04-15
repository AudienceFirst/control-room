import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { refreshLinkedInTokens } from "./oauth";

export class LinkedInIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinkedInIntegrationError";
  }
}

export async function getValidLinkedInToken(clientId: string): Promise<string> {
  const connection = await prisma.linkedInConnection.findUnique({
    where: { clientId },
  });

  if (!connection || !connection.isValid) {
    throw new LinkedInIntegrationError("LinkedIn not connected");
  }

  const bufferMs = 5 * 60 * 1000;
  const expiresAt = connection.tokenExpiresAt.getTime();

  if (Date.now() + bufferMs >= expiresAt) {
    return refreshAndGetToken(connection);
  }

  return decrypt(connection.accessToken);
}

async function refreshAndGetToken(connection: {
  id: string;
  clientId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}): Promise<string> {
  const refreshToken = decrypt(connection.refreshToken);

  try {
    const tokens = await refreshLinkedInTokens(refreshToken);
    const accessToken = encrypt(tokens.access_token);
    const newRefresh = encrypt(tokens.refresh_token ?? refreshToken);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.linkedInConnection.update({
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
    await prisma.linkedInConnection.update({
      where: { id: connection.id },
      data: { isValid: false },
    });
    throw new LinkedInIntegrationError("LinkedIn token refresh failed");
  }
}
