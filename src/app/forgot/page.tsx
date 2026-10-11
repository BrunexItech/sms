import { Suspense } from "react";
import { ForgotView } from "@/components/AuthPages";
import { PageHero, SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";

export const metadata = { title: "Forgot password | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell chat={false}>
      <PageHero eyebrow="Reset" title={<>Forgot password</>} />
      <div className="bg-bone pt-12">
        <Suspense fallback={<BlockLoader label="Loading" />}>
          <ForgotView />
        </Suspense>
      </div>
    </SiteShell>
  );
}
