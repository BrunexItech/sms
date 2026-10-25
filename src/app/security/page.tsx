import { Suspense } from "react";
import { SecurityView } from "@/components/AuthPages";
import { PageHero, SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";

export const metadata = { title: "Security | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell chat={false}>
      <PageHero plain eyebrow="Account" title={<>Security</>} />
      <div className="bg-bone pt-12">
        <Suspense fallback={<BlockLoader label="Loading" />}>
          <SecurityView />
        </Suspense>
      </div>
    </SiteShell>
  );
}
