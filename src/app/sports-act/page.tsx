import { ExternalLink, FileText, Gavel, Scale, ShieldCheck } from "lucide-react";
import { PageHero, SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Sports Act 2013 | National Sports Registry, Kenya" };

const ITEMS = [
  { icon: FileText, t: "Registration of sports organisations", d: "National sports organisations register with the Sports Registrar, supplying prescribed particulars, supporting documents and fees." },
  { icon: ShieldCheck, t: "Licensing of professionals", d: "The Registrar licenses professional sports bodies and professional sports persons and maintains the registers." },
  { icon: Scale, t: "Registrar as authority", d: "This platform separates stakeholder onboarding from legal verification. The Registrar makes the final decision." },
  { icon: Gavel, t: "Integrity and disputes", d: "Suspensions and reinstatements are recorded with reasons, preserved in the audit trail." },
];

export default function SportsActPage() {
  return (
    <SiteShell>
      <PageHero eyebrow="Reference" title={<>The Sports Act, <em className="text-gold">2013.</em></>}>
        The legal framework this platform is designed around.
      </PageHero>
      <section className="bg-bone py-16">
        <div className="mx-auto max-w-4xl space-y-8 px-5">
          <p className="rounded-xl border-l-4 border-gold bg-gold-soft/60 p-4 text-sm text-ink-2">
            This page summarises the Act for orientation. It does not replace legal advice or the Registrar&apos;s prescribed registration process.
          </p>
          <div className="rounded-3xl bg-paper p-8 leading-relaxed text-ink-2 shadow-sm">
            <p>
              The Sports Act, 2013 establishes the legal framework for sports development and regulation in Kenya. The Office of the Sports
              Registrar was established under the Act and is mandated by the State Department for Sports to regulate sports organisations and
              professional sports bodies and persons, including registration of sports organisations, licensing of professional sports bodies and
              professional sports persons, maintaining registers and related functions.
            </p>
            <p className="mt-4">
              The Act contains provisions on registration of national sports organisations, including application particulars, supporting documents
              and prescribed fees. The platform therefore separates stakeholder onboarding from legal verification and licensing, and treats the
              Ministry and Registrar as the authority for final validation.
            </p>
            <a
              href="https://new.kenyalaw.org/akn/ke/act/2013/25/eng@2022-12-31/source"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-forest-800 px-6 py-3 text-sm font-semibold text-white hover:bg-forest-700"
            >
              Open the official text on Kenya Law <ExternalLink size={15} />
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {ITEMS.map((i) => (
              <div key={i.t} className="rounded-3xl border border-line bg-paper p-6">
                <i.icon size={24} className="text-forest-700" strokeWidth={1.6} />
                <h3 className="font-display mt-4 text-base font-medium">{i.t}</h3>
                <p className="mt-1.5 text-sm text-ink-2">{i.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
