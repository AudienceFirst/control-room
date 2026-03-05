import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
});
