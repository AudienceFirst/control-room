"use client";

import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-10 text-center">
        <h1 className="text-xl font-semibold text-white">Access Denied</h1>
        <p className="text-sm text-zinc-400">
          Only ZUID email addresses can access the Control Room. Please sign in
          with an @zuid.com account.
        </p>
        <Link
          href="/auth/signin"
          className="inline-block rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
