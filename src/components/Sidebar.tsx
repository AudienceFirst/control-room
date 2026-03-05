"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";

const navItems = [
  {
    href: "/control-room",
    label: "Control Room",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/settings/clients",
    label: "Settings",
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950 px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-semibold tracking-tight text-white">ZUID Control Room</span>
      </div>

      {/* Overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-zinc-800/80 bg-zinc-950 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-5 py-4">
          <h2 className="text-base font-semibold tracking-tight text-white">
            ZUID Control Room
          </h2>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-1 text-zinc-400 hover:text-white md:hidden"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 p-3" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2 ${
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-800/80 p-3">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:outline-offset-2"
            aria-label="Sign out"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
