import { Suspense } from "react";
import { DirectoryView } from "@/components/DirectoryView";
import { PageHero, SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";

export const metadata = { title: "Technical Teams | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Technical teams" title={<>Technical teams &amp; <em className="text-gold">coaches.</em></>}>
        Coaches and technical teams approved to work in Kenyan sport.
      </PageHero>
      <div className="bg-bone pt-12">
        <Suspense fallback={<BlockLoader label="Loading the register" />}>
          <DirectoryView initialTab="teams" />
        </Suspense>
      </div>
    </SiteShell>
  );
}
