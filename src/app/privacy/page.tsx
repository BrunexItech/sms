import { PageHero, SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Privacy notice | National Sports Registry, Kenya" };

const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-line bg-white p-6 sm:p-7">
    <h2 className="text-lg font-extrabold text-forest-900">{t}</h2>
    <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-ink-2">{children}</div>
  </section>
);

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Privacy" title={<>How we handle <em className="text-gold">your data.</em></>}>Draft for legal review before launch.</PageHero>
      <div className="bg-bone pb-24 pt-12">
        <div className="mx-auto max-w-3xl space-y-5 px-5">
          <p className="-mt-8 rounded-xl border-l-4 border-gold bg-gold-soft p-4 text-sm text-ink-2">
            This notice is a working draft prepared with the platform. The Ministry&apos;s legal office must review and adopt it, and confirm registration as a data controller with the Office of the Data Protection Commissioner, before the service goes live.
          </p>
          <S t="What we collect">
            <p>Identity and contact details (name, ID or passport number, KRA PIN, phone, email), location (county, sub-county, ward, optional GPS), sport and level, date of birth and competition category for players, guardian details for players under 18, payment references, and files you choose to upload (photos, trial videos, club documents).</p>
          </S>
          <S t="Why we collect it">
            <p>To register and verify sports stakeholders under the Sports Act 2013, to issue and verify certificates, to administer fees, and to maintain a register of facilities. We do not use it for advertising.</p>
          </S>
          <S t="Who can see it">
            <p>The public sees only facilities, events and certificate verification. The register of players and clubs is restricted. Your own officers (your county, your federation, the Registrar) see what they need to verify you; federations do not see ID, KRA PIN, phone or email. A club sees only its own roster. Uploaded files are never public.</p>
          </S>
          <S t="Children">
            <p>For players under 18 a parent or guardian must consent at registration. Photos and videos of minors are visible only to the registering account and verifying officers.</p>
          </S>
          <S t="Your rights">
            <p>You may ask to see, correct or delete your data, and to withdraw consent for optional uploads, by contacting info@sports.go.ke. Some records must be kept to meet the Sports Act and audit requirements.</p>
          </S>
          <S t="Security and cookies">
            <p>Passwords are stored as salted hashes. Staff actions are logged. We use one essential session cookie to keep you signed in; we do not use advertising or tracking cookies.</p>
          </S>
        </div>
      </div>
    </SiteShell>
  );
}
