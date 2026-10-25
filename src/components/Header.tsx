"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, LogIn, Menu, Phone, Search, UserRound, X } from "lucide-react";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { useLang } from "@/lib/i18n";
import { useStore } from "@/lib/store";

const NAV: { href: string; label: string; sw: string }[] = [
  { href: "/", label: "Home", sw: "Mwanzo" },
  { href: "/federations", label: "Federations", sw: "Mashirikisho" },
  { href: "/clubs", label: "Clubs", sw: "Klabu" },
  { href: "/verify", label: "Verify", sw: "Thibitisha" },
  { href: "/facilities", label: "Facilities", sw: "Vituo" },
  { href: "/events", label: "Events", sw: "Matukio" },
  { href: "/sports-act", label: "Sports Act", sw: "Sheria ya Michezo" },
  { href: "/resources", label: "Resources", sw: "Rasilimali" },
  { href: "/contact", label: "Contact", sw: "Wasiliana" },
];

export function Header() {
  const { lang, setLang } = useLang();
  const { user, member } = useStore();
  const nav = NAV;
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const account = user
    ? { href: "/console", label: "Console", icon: <LayoutDashboard size={15} /> }
    : member
      ? { href: "/account", label: "My account", icon: <UserRound size={15} /> }
      : { href: "/login", label: "Login", icon: <LogIn size={15} /> };

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/clubs?q=${encodeURIComponent(q.trim())}`);
    setSearching(false);
    setQ("");
  };

  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  return (
    <header className="sticky top-0 z-50 print:hidden">
      <div className="bg-forest-950 text-[11.5px] text-white/75">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-1.5">
          <p className="hidden sm:block">An official Government of Kenya service platform · National Sports Digital Registry</p>
          <div className="ml-auto flex items-center gap-5">
            <a href="tel:+254202227471" className="flex items-center gap-1.5 transition hover:text-white">
              <Phone size={12} /> +254 20 222 7471
            </a>
            <div role="group" aria-label="Language" className="flex items-center overflow-hidden rounded-full border border-white/25">
              {(["en", "sw"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`px-2.5 py-0.5 text-[11px] font-semibold transition ${lang === l ? "bg-gold text-forest-950" : "text-white/75 hover:text-white"}`}
                >
                  {l === "en" ? "English" : "Kiswahili"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={`glass border-b transition-shadow ${scrolled ? "border-line shadow-[0_8px_24px_-18px_rgba(6,45,87,0.5)]" : "border-line"}`}>
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 px-5 py-2.5 sm:gap-4">
          <Link href="/" aria-label="Ministry of Sports, home" className="shrink-0">
            <Logo />
          </Link>

          {searching ? (
            <form onSubmit={go} className="hidden max-w-2xl flex-1 items-center overflow-hidden rounded-lg border border-forest-700 bg-white shadow-sm xl:flex">
              <Search size={17} className="ml-3.5 shrink-0 text-ink-3" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search clubs and facilities…"
                className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none"
              />
              <button type="submit" className="bg-forest-800 px-4 py-2.5 text-sm font-bold text-white">Search</button>
              <button type="button" onClick={() => setSearching(false)} aria-label="Close search" className="px-3 text-ink-3 hover:text-ink">
                <X size={17} />
              </button>
            </form>
          ) : (
          <nav className="hidden items-center gap-0.5 xl:flex" aria-label="Primary">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-[13.5px] font-semibold transition ${
                  isActive(n.href) ? "bg-gold text-forest-950 shadow-sm" : "text-forest-900 hover:bg-forest-100"
                }`}
              >
                {lang === "sw" ? n.sw : n.label}
              </Link>
            ))}
          </nav>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2">
            {!searching && (
              <button onClick={() => setSearching(true)} aria-label="Search" className="hidden h-10 w-10 place-items-center rounded-lg text-forest-900 hover:bg-forest-100 sm:grid">
                <Search size={19} />
              </button>
            )}
            {(user || member) && <NotificationBell allHref={account.href} />}
            <Link href={account.href} className="hidden items-center gap-2 whitespace-nowrap rounded-lg border border-forest-900/30 px-5 py-2.5 text-sm font-semibold text-forest-900 transition hover:bg-forest-100 sm:flex">
              {account.icon} {account.label}
            </Link>
            {!user && !member && <Link href="/register" className="hidden rounded-lg bg-gradient-to-b from-forest-800 to-forest-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(6,45,87,0.8)] transition hover:brightness-110 sm:block">
              {lang === "sw" ? "Jisajili" : "Register"}
            </Link>}
            <button className="grid h-10 w-10 place-items-center rounded-lg border border-line xl:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Toggle menu">
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-line bg-white px-5 py-3 xl:hidden" aria-label="Mobile">
            <div className="grid gap-1 sm:grid-cols-2">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-3 text-base font-semibold ${isActive(n.href) ? "bg-gold text-forest-950" : "text-forest-900 hover:bg-forest-100"}`}
                >
                  {lang === "sw" ? n.sw : n.label}
                </Link>
              ))}
            </div>
            <div className={`mt-3 grid gap-2 ${user || member ? "grid-cols-1" : "grid-cols-2"}`}>
              <Link href={account.href} onClick={() => setOpen(false)} className="rounded-lg border border-forest-900/30 px-3 py-3 text-center font-semibold text-forest-900">{account.label}</Link>
              {!user && !member && <Link href="/register" onClick={() => setOpen(false)} className="rounded-lg bg-forest-900 px-3 py-3 text-center font-semibold text-white">{lang === "sw" ? "Jisajili" : "Register"}</Link>}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
