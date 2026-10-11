import { PageHero, SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Terms of use | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Terms" title={<>Terms of <em className="text-gold">use.</em></>}>Draft for legal review before launch.</PageHero>
      <div className="bg-bone pb-24 pt-12">
        <div className="mx-auto max-w-3xl space-y-4 px-5 text-[15px] leading-relaxed text-ink-2">
          <p className="-mt-8 rounded-xl border-l-4 border-gold bg-gold-soft p-4 text-sm">Working draft. The Ministry&apos;s legal office must review and adopt these terms before launch.</p>
          {[
            ["Accurate information", "You must give true information. A false claim of identity, age, level or club membership can lead to rejection, suspension or revocation."],
            ["Your account", "Keep your password and authenticator private. You are responsible for activity on your account, including players registered by a club account."],
            ["Fees", "Registration and renewal fees are set by the Ministry and are non-refundable once verification has started, unless the Registrar decides otherwise."],
            ["Uploads", "Upload only material you have the right to share. Do not upload content of other people without their consent, or of children without a parent's or guardian's consent."],
            ["Decisions and appeals", "Registrations are decided by the Sports Registrar after county and federation review. You may appeal a rejection or suspension from My account."],
            ["Certificates", "A certificate is valid until the date it shows and must be renewed. Anyone may verify it on the platform."],
          ].map(([t, b]) => (
            <section key={t} className="rounded-2xl border border-line bg-white p-5"><h2 className="font-extrabold text-forest-900">{t}</h2><p className="mt-1">{b}</p></section>
          ))}
        </div>
      </div>
    </SiteShell>
  );
}
