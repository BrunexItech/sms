import { Suspense } from "react";
import { FacilitiesExplorer } from "@/components/FacilitiesExplorer";
import { PageHero, SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";

export const metadata = { title: "Facilities Map | National Sports Registry, Kenya" };

export default function FacilitiesPage() {
  return (
    <SiteShell>
      <PageHero eyebrow="Facilities register" title={<>Every facility, <em className="text-gold">on the map.</em></>}>
        Search any place in Kenya, browse stadiums, pitches, pools and courts by county, or register a facility by
        placing it on the map. Built on free OpenStreetMap data.
      </PageHero>
      <div className="bg-bone pt-12">
        <Suspense fallback={<BlockLoader label="Preparing the map" />}>
          <FacilitiesExplorer />
        </Suspense>
      </div>
    </SiteShell>
  );
}
