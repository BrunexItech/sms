import { Suspense } from "react";
import { DirectoryView } from "@/components/DirectoryView";
import { PageHero, SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";

export const metadata = { title: "Players | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Players & sportspersons" title={<>Registered <em className="text-gold">players.</em></>}>
        Athletes and sportspersons with an approved registration on the national record.
      </PageHero>
      <div className="bg-bone pt-12">
        <Suspense fallback={<BlockLoader label="Loading the register" />}>
          <DirectoryView initialTab="players" />
        </Suspense>
      </div>
    </SiteShell>
  );
}
