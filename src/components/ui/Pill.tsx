const TONES: Record<string, string> = {
  Submitted: "bg-blue-100 text-blue-800",
  "Under review": "bg-amber-100 text-amber-800",
  "Needs info": "bg-orange-100 text-orange-800",
  Endorsed: "bg-teal-100 text-teal-800",
  Approved: "bg-leaf-soft text-leaf",
  Verified: "bg-leaf-soft text-leaf",
  Paid: "bg-leaf-soft text-leaf",
  Rejected: "bg-red-100 text-kenya-red-deep",
  Suspended: "bg-red-100 text-kenya-red-deep",
  Refunded: "bg-red-100 text-kenya-red-deep",
  Unverified: "bg-stone-200 text-stone-700",
  Pending: "bg-stone-200 text-stone-700",
  Excellent: "bg-leaf-soft text-leaf",
  Good: "bg-leaf-soft text-leaf",
  Fair: "bg-amber-100 text-amber-800",
  Poor: "bg-red-100 text-kenya-red-deep",
  "Under renovation": "bg-orange-100 text-orange-800",
};

export function Pill({ children }: { children: string }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONES[children] ?? "bg-stone-200 text-stone-700"}`}
    >
      {children}
    </span>
  );
}
