"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-10 shadow-2xl">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            ZUID Control Room
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Log in met je ZUID e-mailadres
          </p>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-600 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Inloggen met Google
          </button>

          <p className="text-center text-xs text-zinc-500">
            Alleen @zuid.com e-mailadressen zijn toegestaan
          </p>
        </div>
      </div>
    </div>
  );
}
