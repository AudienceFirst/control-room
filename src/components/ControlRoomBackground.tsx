"use client";

/**
 * Subtle control room ambient: soft mesh gradient and thin convergence lines.
 * Smooth, minimal, 2026. Conveys "everything comes together here" without distraction.
 */
export function ControlRoomBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {/* Soft mesh gradient orbs - contemporary 2026 look */}
      <div
        className="absolute -top-32 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 30%, rgba(34, 197, 94, 0.12), transparent 60%)",
          filter: "blur(60px)",
          animation: "ambient-drift 12s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -right-20 top-1/3 h-80 w-80 -translate-y-1/2 rounded-full opacity-15"
        style={{
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.15), transparent 60%)",
          filter: "blur(50px)",
          animation: "ambient-drift 14s ease-in-out 2s infinite",
        }}
      />
      <div
        className="absolute -left-20 bottom-1/4 h-64 w-64 rounded-full opacity-12"
        style={{
          background: "radial-gradient(circle, rgba(34, 197, 94, 0.1), transparent 60%)",
          filter: "blur(45px)",
          animation: "ambient-drift 16s ease-in-out 4s infinite",
        }}
      />

      {/* Thin convergence lines - static, very subtle */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.06]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(113, 113, 122, 0.5)" />
            <stop offset="50%" stopColor="rgba(34, 197, 94, 0.3)" />
            <stop offset="100%" stopColor="rgba(113, 113, 122, 0.5)" />
          </linearGradient>
        </defs>
        <path d="M 0 0 Q 20 12, 50 5" fill="none" stroke="url(#lineGrad)" strokeWidth="0.3" strokeLinecap="round" />
        <path d="M 100 0 Q 80 12, 50 5" fill="none" stroke="url(#lineGrad)" strokeWidth="0.3" strokeLinecap="round" />
        <path d="M 0 100 Q 30 55, 50 8" fill="none" stroke="url(#lineGrad)" strokeWidth="0.25" strokeLinecap="round" />
        <path d="M 100 100 Q 70 55, 50 8" fill="none" stroke="url(#lineGrad)" strokeWidth="0.25" strokeLinecap="round" />
        <path d="M 50 100 Q 50 50, 50 6" fill="none" stroke="url(#lineGrad)" strokeWidth="0.25" strokeLinecap="round" />
      </svg>

      {/* Very subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: "radial-gradient(rgba(113, 113, 122, 0.8) 1px, transparent 1px)",
          backgroundSize: "2.5rem 2.5rem",
        }}
      />
    </div>
  );
}
