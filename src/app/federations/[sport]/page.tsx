import { PageHero, SiteShell } from "@/components/SiteShell";
import { FederationProfile } from "@/components/FederationProfile";

export const metadata = { title: "Federation | National Sports Registry, Kenya" };

export default async function Page({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  return (
    <SiteShell>
      <PageHero eyebrow="Governing body" title={<>Federation <em className="text-gold">profile.</em></>}>
        The national federation, its county branches and the clubs under it.
      </PageHero>
      <div className="bg-bone pb-20 pt-12">
        <FederationProfile sport={sport} />
      </div>
    </SiteShell>
  );
}
