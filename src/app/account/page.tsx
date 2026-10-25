import { AccountView } from "@/components/AccountView";
import { PageHero, SiteShell } from "@/components/SiteShell";

export const metadata = { title: "My registration | National Sports Registry, Kenya" };

export default function AccountPage() {
  return (
    <SiteShell>
      <PageHero eyebrow="My account" title={<>Your registrations, <em className="text-gold">in one place.</em></>}>
        Track verification, pay fees, download certificates and manage your roster.
      </PageHero>
      <div className="bg-bone pt-12"><AccountView /></div>
    </SiteShell>
  );
}
