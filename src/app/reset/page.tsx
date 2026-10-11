import { Suspense } from "react";
import { ResetView } from "@/components/AuthPages";
import { PageHero, SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";

export const metadata = { title: "Reset password | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell chat={false}>
      <PageHero eyebrow="Reset" title={<>Reset password</>} />
      <div className="bg-bone pt-12">
        <Suspense fallback={<BlockLoader label="Loading" />}>
          <ResetView />
        </Suspense>
      </div>
    </SiteShell>
  );
}
