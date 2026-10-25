import { Suspense } from "react";
import { DirectoryView } from "@/components/DirectoryView";
import { PageHero, SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";

export const metadata = { title: "Federations | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Public register" title={<>Sports <em className="text-gold">federations.</em></>}>
        The recognised governing body of each sport and the county branches registered under it. Open one to see its leadership and branches.
      </PageHero>
      <div className="bg-bone pt-12">
        <Suspense fallback={<BlockLoader label="Loading the register" />}>
          <DirectoryView initialTab="federations" scope="public" tabs={["federations", "branches"]} />
        </Suspense>
      </div>
    </SiteShell>
  );
}
