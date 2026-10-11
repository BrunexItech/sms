import { Suspense } from "react";
import { DirectoryView } from "@/components/DirectoryView";
import { PageHero, SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";

export const metadata = { title: "Clubs | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Public register" title={<>Registered <em className="text-gold">clubs.</em></>}>
        Verified clubs, academies, federations, sports businesses and facility operators across Kenya. Find yours, or register it.
      </PageHero>
      <div className="bg-bone pt-12">
        <Suspense fallback={<BlockLoader label="Loading the register" />}>
          <DirectoryView initialTab="clubs" scope="public" />
        </Suspense>
      </div>
    </SiteShell>
  );
}
