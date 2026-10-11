export const inputCls =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-[15px] outline-none transition placeholder:text-ink-3/60 focus:border-forest-600 focus:ring-4 focus:ring-forest-600/12 disabled:bg-bone disabled:text-ink-3";

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">
        {label} {required && <span className="text-kenya-red">*</span>}
      </span>
      {children}
      {error ? (
        <span data-field-error className="mt-1.5 block text-xs font-medium text-kenya-red">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-ink-3">{hint}</span>
      ) : null}
    </label>
  );
}
