import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import { PageHero, SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Contact | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Contact" title={<>Talk to the <em className="text-gold">Ministry.</em></>}>
        Questions about registration, payments, facilities or events.
      </PageHero>
      <section className="bg-bone pb-24 pt-12">
        <div className="mx-auto grid max-w-[1100px] gap-6 px-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="-mt-8 rounded-2xl bg-gradient-to-b from-forest-800 to-forest-900 p-7 text-white">
            <h2 className="text-xl font-extrabold">Ministry of Sports</h2>
            <ul className="mt-5 space-y-5 text-sm text-white/85">
              <li className="flex gap-3"><MapPin size={18} className="mt-0.5 shrink-0 text-gold" /> Jogoo House &lsquo;A&rsquo;, Harambee Avenue, P.O. Box 47205 – 00100, Nairobi</li>
              <li className="flex gap-3"><Phone size={18} className="shrink-0 text-gold" /> +254 20 222 7471</li>
              <li className="flex gap-3"><Mail size={18} className="shrink-0 text-gold" /> info@sports.go.ke</li>
              <li className="flex gap-3"><Clock size={18} className="shrink-0 text-gold" /> Monday to Friday, 8:00 am – 5:00 pm</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-white p-7 lg:-mt-8">
            <h2 className="mb-5 text-xl font-extrabold text-forest-900">Send a message</h2>
            <ContactForm />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
