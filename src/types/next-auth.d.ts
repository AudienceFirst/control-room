import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id?: string;
      role?: string;
    };
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role?: string;
  }
}
