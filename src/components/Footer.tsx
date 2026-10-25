import Link from "next/link";
import { ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "./Logo";

const SOCIAL = [
  { label: "Facebook", d: "M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.4V21h3.1z" },
  { label: "X", d: "M17.8 3.5h2.9l-6.3 7.2 7.4 9.8h-5.8l-4.5-5.9-5.2 5.9H3.4l6.7-7.7L3 3.5h5.9l4.1 5.4 4.8-5.4zm-1 15.3h1.6L7.3 5.1H5.6l11.2 13.7z" },
  { label: "YouTube", d: "M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z" },
  { label: "LinkedIn", d: "M5.2 8.8H2.1V21h3.1V8.8zM3.6 3.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM21.9 14c0-3.3-1.8-5.4-4.5-5.4-1.5 0-2.6.8-3.1 1.6V8.8h-3V21h3.1v-6.7c0-1.7.8-2.8 2.2-2.8 1.3 0 1.9 1 1.9 2.7V21h3.1l.3-7z" },
];

export function Footer() {
  return (
    <footer className="bg-forest-900 text-white print:hidden">
      <div className="flag-rule" />
      <div className="mx-auto grid max-w-[1500px] gap-12 px-5 py-14 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/65">
            The National Sports Digital Registry: sportspersons, clubs, academies, technical teams, scouts, sports
            businesses and facilities, mapped from County to Sub-County to Ward.
          </p>
          <div className="mt-6 flex gap-2.5">
            {SOCIAL.map((s) => (
              <a key={s.label} href="#" aria-label={s.label} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition hover:bg-gold hover:text-forest-950">
                <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-current"><path d={s.d} /></svg>
              </a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-gold">Platform</h3>
          <ul className="mt-5 space-y-3 text-sm text-white/75">
            {[
              ["Register", "/register"],
              ["Clubs", "/clubs"],
              ["Federations", "/federations"],
              ["Facilities map", "/facilities"],
              ["Events", "/events"],
              ["Verify a certificate", "/verify"],
            ].map(([l, h]) => (
              <li key={l}><Link href={h} className="transition hover:text-white">{l}</Link></li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-gold">Official sources</h3>
          <ul className="mt-5 space-y-3 text-sm text-white/75">
            {[
              ["State Department for Sports", "https://www.sports.go.ke/"],
              ["Sports Act 2013 (Kenya Law)", "https://new.kenyalaw.org/akn/ke/act/2013/25/eng@2022-12-31/source"],
            ].map(([l, h]) => (
              <li key={l}>
                <a href={h} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 transition hover:text-white">
                  {l} <ExternalLink size={12} />
                </a>
              </li>
            ))}
            <li><Link href="/privacy" className="transition hover:text-white">Privacy notice</Link></li>
            <li><Link href="/terms" className="transition hover:text-white">Terms of use</Link></li>
            <li><Link href="/credits" className="transition hover:text-white">Photo & data credits</Link></li>
            <li><Link href="/staff" className="transition hover:text-white">Staff sign in</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-gold">Contact</h3>
          <ul className="mt-5 space-y-3.5 text-sm text-white/75">
            <li className="flex gap-3"><MapPin size={17} className="mt-0.5 shrink-0 text-white/45" /><span>Jogoo House &lsquo;A&rsquo;, Harambee Avenue, P.O. Box 47205 – 00100, Nairobi</span></li>
            <li className="flex gap-3"><Phone size={17} className="shrink-0 text-white/45" />+254 20 222 7471</li>
            <li className="flex gap-3"><Mail size={17} className="shrink-0 text-white/45" />info@sports.go.ke</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-white/50">
        © 2026 Ministry of Sports, Republic of Kenya. Prototype for review: records are illustrative.
      </div>
    </footer>
  );
}
