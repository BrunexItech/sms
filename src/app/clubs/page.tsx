import { Suspense } from "react";
import { DirectoryView } from "@/components/DirectoryView";
import { PageHero, SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";

export const metadata = { title: "Clubs | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Clubs & organisations" title={<>Registered <em className="text-gold">clubs.</em></>}>
        Clubs, academies, federations, sports businesses, facility operators and event organisers.
      </PageHero>
      <div className="bg-bone pt-12">
        <Suspense fallback={<BlockLoader label="Loading the register" />}>
          <DirectoryView initialTab="clubs" />
        </Suspense>
      </div>
    </SiteShell>
  );
}
