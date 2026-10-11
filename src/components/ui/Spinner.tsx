/**
 * Branded loading indicator: three concentric arcs in the national colours
 * (black, red, green) turning at different speeds around a gold core.
 */
export function Spinner({
  size = 48,
  tone = "dark",
  label,
  className = "",
}: {
  size?: number;
  /** "light" swaps the black arc for white, for use on dark backgrounds. */
  tone?: "dark" | "light";
  label?: string;
  className?: string;
}) {
  const black = tone === "light" ? "#ffffff" : "#0a0a0a";
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex flex-col items-center gap-3 ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden
        className="overflow-visible"
      >
        <circle cx="32" cy="32" r="28" stroke={black} strokeOpacity="0.08" strokeWidth="4" />
        <circle cx="32" cy="32" r="20" stroke={black} strokeOpacity="0.08" strokeWidth="4" />
        <circle cx="32" cy="32" r="12" stroke={black} strokeOpacity="0.08" strokeWidth="4" />
        <g className="spin-a">
          <circle cx="32" cy="32" r="28" stroke={black} strokeWidth="4" strokeLinecap="round" strokeDasharray="60 116" />
        </g>
        <g className="spin-b">
          <circle cx="32" cy="32" r="20" stroke="#c8102e" strokeWidth="4" strokeLinecap="round" strokeDasharray="42 84" />
        </g>
        <g className="spin-c">
          <circle cx="32" cy="32" r="12" stroke="#1a9150" strokeWidth="4" strokeLinecap="round" strokeDasharray="26 50" />
        </g>
        <circle cx="32" cy="32" r="4" fill="#c9a24b" className="spin-core" />
      </svg>
      {label ? (
        <span
          className={`text-sm font-medium ${tone === "light" ? "text-white/80" : "text-ink-2"}`}
        >
          {label}
        </span>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </span>
  );
}

/** Full-screen loader used while the registry boots. */
export function PageLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-bone">
      <div className="flex flex-col items-center gap-7">
        <div className="flex h-12 items-stretch gap-1" aria-hidden>
          <span className="w-1.5 rounded-sm bg-black" />
          <span className="w-1.5 rounded-sm bg-kenya-red" />
          <span className="w-1.5 rounded-sm bg-forest-600" />
        </div>
        <Spinner size={72} label={label} />
        <p className="eyebrow text-ink-3">Republic of Kenya · Ministry of Sports</p>
      </div>
    </div>
  );
}

/** Centered block loader for panels and tables. */
export function BlockLoader({
  label = "Loading",
  className = "",
  tone = "dark",
}: {
  label?: string;
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <div className={`grid place-items-center py-16 ${className}`}>
      <Spinner size={44} label={label} tone={tone} />
    </div>
  );
}

/** Tiny spinner for buttons. */
export function ButtonSpinner({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 animate-spin ${className}`}
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
