import { PageHero, SiteShell } from "@/components/SiteShell";
import { FederationsList } from "@/components/FederationsList";

export const metadata = { title: "Federations | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Governing bodies" title={<>Sports <em className="text-gold">federations.</em></>}>
        The recognised governing body for each sport. Clubs and players are endorsed by the federation of their sport.
      </PageHero>
      <div className="bg-bone pb-20 pt-12">
        <FederationsList />
      </div>
    </SiteShell>
  );
}
