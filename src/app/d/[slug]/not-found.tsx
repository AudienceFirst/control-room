export default function DashboardNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="text-center">
        <h1 className="text-lg font-medium text-zinc-300">
          Invalid or expired link
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          This dashboard link is no longer valid. Please request a new link from
          your account manager.
        </p>
      </div>
    </div>
  );
}
