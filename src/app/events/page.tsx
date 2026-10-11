import { EventsView } from "@/components/EventsView";
import { PageHero, SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Events | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Upcoming events" title={<>Competitions &amp; <em className="text-gold">events.</em></>}>
        Tournaments, championships and community events across Kenya&apos;s counties.
      </PageHero>
      <div className="bg-bone pt-12"><EventsView /></div>
    </SiteShell>
  );
}
