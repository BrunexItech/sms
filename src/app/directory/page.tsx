import { Suspense } from "react";
import { DirectoryView } from "@/components/DirectoryView";
import { PageHero, SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";

export const metadata = { title: "Directory | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell>
      <PageHero eyebrow="Public register" title={<>The national sports <em className="text-gold">directory.</em></>}>
        Registered people, clubs, teams and every facility on record. Only approved registrations are listed.
      </PageHero>
      <div className="bg-bone pt-12">
        <Suspense fallback={<BlockLoader label="Loading the register" />}>
          <DirectoryView initialTab="players" />
        </Suspense>
      </div>
    </SiteShell>
  );
}
