import { AccountView } from "@/components/AccountView";
import { PageHero, SiteShell } from "@/components/SiteShell";

export const metadata = { title: "My registration | National Sports Registry, Kenya" };

export default function AccountPage() {
  return (
    <SiteShell>
      <PageHero eyebrow="My registration" title={<>Where your application <em className="text-gold">stands.</em></>} />
      <div className="bg-bone pt-12"><AccountView /></div>
    </SiteShell>
  );
}
