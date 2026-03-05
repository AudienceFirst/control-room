import { randomBytes, createHash } from "crypto";

const TOKEN_BYTES = 32;
const HASH_ALGORITHM = "sha256";

/**
 * Generate a new cryptographically random token and its hash.
 * Return the raw token once (for the share URL); store only the hash.
 */
export function generateDashboardToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(token);
  return { token, tokenHash };
}

/**
 * Hash a token with SHA-256 (hex). Use this to compare query param to stored hash.
 */
export function hashToken(token: string): string {
  return createHash(HASH_ALGORITHM).update(token, "utf8").digest("hex");
}

/**
 * Verify that the provided token matches the stored hash (constant-time friendly).
 */
export function verifyDashboardToken(plainToken: string, storedHash: string): boolean {
  if (!plainToken || !storedHash) return false;
  const computed = hashToken(plainToken);
  if (computed.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}

const BASE_PATH = "/d";

/** Base URL for dashboard (no token) — for “Open dashboard” when logged in. */
export function getDashboardBaseUrl(slug: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof process.env.VERCEL_URL === "string"
      ? `https://${process.env.VERCEL_URL}`
      : null) ||
    "http://localhost:3000";
  const origin = base.startsWith("http") ? base : `https://${base}`;
  return `${origin}${BASE_PATH}/${slug}`;
}
