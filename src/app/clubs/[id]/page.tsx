import { PageHero, SiteShell } from "@/components/SiteShell";
import { ClubProfile } from "@/components/ClubProfile";

export const metadata = { title: "Club | National Sports Registry, Kenya" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <SiteShell>
      <PageHero eyebrow="Registered club" title={<>Club <em className="text-gold">profile.</em></>}>
        A verified organisation on the National Sports Registry.
      </PageHero>
      <div className="bg-bone pb-20 pt-12">
        <ClubProfile id={id} />
      </div>
    </SiteShell>
  );
}
