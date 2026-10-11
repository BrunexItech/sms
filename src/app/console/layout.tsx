"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Building2,
  CalendarCheck,
  ClipboardList,
  FileClock,
  Home,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Settings,
  UsersRound,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ROLE_BY_ID, type Permission } from "@/lib/roles";
import { useStore } from "@/lib/store";

const NAV: { href: string; label: string; icon: React.ReactNode; perm?: Permission | Permission[] }[] = [
  { href: "/console", label: "Overview", icon: <LayoutDashboard size={18} /> },
  { href: "/console/applications", label: "Applications", icon: <ClipboardList size={18} />, perm: "applications.view" },
  { href: "/console/events", label: "Events", icon: <CalendarCheck size={18} />, perm: "applications.review" },
  { href: "/console/facilities", label: "Facilities", icon: <MapPinned size={18} />, perm: "facilities.verify" },
  { href: "/console/federations", label: "Federations", icon: <Landmark size={18} />, perm: "federations.manage" },
  { href: "/console/payments", label: "Payments", icon: <Wallet size={18} />, perm: "payments.view" },
  { href: "/console/control", label: "Control Center", icon: <UsersRound size={18} />, perm: "users.manage" },
  { href: "/console/audit", label: "Audit log", icon: <FileClock size={18} />, perm: "audit.view" },
  { href: "/console/settings", label: "Settings", icon: <Settings size={18} />, perm: "settings.manage" },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user, can, logout, state } = useStore();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (!user) router.replace("/staff");
    else if (user.mustChangePassword || user.needs2fa) router.replace("/security");
  }, [user, router]);

  if (!user) return null;
  const role = ROLE_BY_ID[user.role];
  const items = NAV.filter((n) => !n.perm || can(n.perm as Permission));

  return (
    <div className="min-h-screen bg-bone lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="border-b border-line bg-forest-950 text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0">
        <div className="flex flex-col gap-5 p-4 lg:min-h-full">
          <Link href="/" aria-label="Public site"><Logo light /></Link>
          <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Console">
            {items.map((n) => {
              const active = n.href === "/console" ? path === "/console" : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                    active ? "bg-white text-forest-900" : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {n.icon} {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto hidden shrink-0 rounded-2xl bg-white/8 p-4 lg:block">
            <p className="eyebrow text-[10px] text-gold">{role.label}</p>
            <p className="mt-1.5 font-semibold">{user.name}</p>
            <p className="text-xs text-white/55">{user.title}</p>
            <div className="mt-4 flex gap-2">
              <Link href="/" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 py-2 text-xs font-semibold hover:bg-white/20"><Home size={13} /> Site</Link>
              <button
                onClick={() => { logout(); router.push("/staff"); }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 py-2 text-xs font-semibold hover:bg-white/20"
              >
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper px-6 py-3 lg:hidden">
          <span className="flex items-center gap-2 text-sm font-semibold"><Building2 size={16} /> {user.name} · {role.label}</span>
          <button onClick={() => { logout(); router.push("/staff"); }} className="text-xs font-semibold text-kenya-red">Sign out</button>
        </div>
        {state.config.demo && (
          <div className="bg-gold-soft/70 px-6 py-2 text-center text-xs text-ink-2">
            Demo environment: the sample people, clubs and payments here are illustrative.
          </div>
        )}
        <div className="mx-auto max-w-[1280px] px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
