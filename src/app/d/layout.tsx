/**
 * Public client dashboard layout: no sidebar, minimal chrome.
 * Used for /d/[slug] (share link or ZUID session).
 */
export default function ClientDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {children}
    </div>
  );
}
