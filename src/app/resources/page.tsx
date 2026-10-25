import Link from "next/link";
import { BookOpen, ExternalLink, FileText, HelpCircle, ShieldCheck } from "lucide-react";
import { PageHero, SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Resources | National Sports Registry, Kenya" };

const FAQ = [
  ["Who must register?", "Sports organisations and professional sports persons, as set out in the Sports Act 2013. The platform also lists clubs, academies, technical teams, scouts, agents, sports businesses, facility operators, event organisers and federations."],
  ["How much does registration cost?", "Individuals pay KSh 500 and clubs KSh 2,000. Fees are set by the Ministry and shown on the Payments page."],
  ["What documents do I need?", "Your National ID or passport, KRA PIN, phone and email. Clubs also provide the chairperson and secretary, and may be asked for a constitution."],
  ["Who approves my registration?", "Your County Sports Officer reviews, your federation endorses membership, and the Sports Registrar decides and issues your certificate."],
  ["How do I prove my registration?", "Print your certificate from My account. Anyone can verify it on the Verify page using its number."],
  ["Is my personal data public?", "No. The public directory lists approved registrations only and never shows ID, KRA PIN, phone or email."],
];

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Resources" title={<>Guides, laws &amp; <em className="text-gold">answers.</em></>}>
        Everything you need to register, comply and find your way around the platform.
      </PageHero>
      <section className="bg-bone pb-24 pt-12">
        <div className="mx-auto max-w-[1100px] space-y-8 px-5">
          <div className="-mt-8 grid gap-5 md:grid-cols-3">
            {[
              { icon: BookOpen, t: "Sports Act 2013", d: "Summary and link to the official text.", href: "/sports-act" },
              { icon: FileText, t: "How to register", d: "Four steps from personal details to payment.", href: "/register" },
              { icon: ShieldCheck, t: "Verify a certificate", d: "Confirm a registration is genuine.", href: "/verify" },
            ].map((c) => (
              <Link key={c.t} href={c.href} className="group rounded-2xl border border-line bg-white p-6 shadow-[0_24px_40px_-30px_rgba(6,45,87,0.5)] transition hover:-translate-y-1">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-forest-100 text-forest-800"><c.icon size={24} strokeWidth={1.6} /></span>
                <h2 className="mt-4 text-base font-bold text-forest-900">{c.t}</h2>
                <p className="mt-1 text-sm text-ink-3">{c.d}</p>
              </Link>
            ))}
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-xl font-bold text-forest-900"><HelpCircle size={24} /> Frequently asked questions</h2>
            <div className="mt-5 divide-y divide-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-forest-900">
                    {q}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-bone text-base transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{a}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
            <h2 className="text-xl font-bold text-forest-900">Official sources</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                ["State Department for Sports", "https://www.sports.go.ke/"],
                ["Sports Act 2013 on Kenya Law", "https://new.kenyalaw.org/akn/ke/act/2013/25/eng@2022-12-31/source"],
                ["IEBC locations", "https://www.iebc.or.ke/admin/pages/locations.php"],
              ].map(([l, h]) => (
                <li key={l}>
                  <a href={h} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-xl border border-line px-4 py-3.5 text-sm font-bold text-forest-800 transition hover:border-forest-700 hover:bg-forest-100">
                    {l} <ExternalLink size={14} />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
