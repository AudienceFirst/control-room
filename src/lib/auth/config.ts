import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

const ALLOWED_DOMAIN = (process.env.AUTH_ALLOWED_DOMAIN ?? "zuid.com").toLowerCase();

// Set to "true" to bypass domain check (dev/testing only)
const SKIP_DOMAIN_CHECK = process.env.AUTH_SKIP_DOMAIN_CHECK === "true";

function isEmailAllowed(email: string): boolean {
  if (!email?.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domain === ALLOWED_DOMAIN || domain.endsWith(`.${ALLOWED_DOMAIN}`);
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: "openid email profile",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      if (SKIP_DOMAIN_CHECK) return true;

      const email = (user?.email ?? (profile as { email?: string })?.email ?? "") as string;
      const hostedDomain = (profile as { hd?: string })?.hd;
      const allowed = isEmailAllowed(email) || (hostedDomain && isEmailAllowed(`x@${hostedDomain}`));

      if (!allowed) {
        console.error("[Auth] signIn rejected:", {
          email: email || "(empty)",
          hostedDomain: hostedDomain || "(none)",
          allowedDomain: ALLOWED_DOMAIN,
        });
        return false;
      }
      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token as { role?: string }).role;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
};
