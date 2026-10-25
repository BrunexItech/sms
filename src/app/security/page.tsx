import { Suspense } from "react";
import { SecurityView } from "@/components/AuthPages";
import { SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";

export const metadata = { title: "Security | National Sports Registry, Kenya" };

export default function Page() {
  return (
    <SiteShell chat={false}>
      <div className="bg-bone pt-16">
        <Suspense fallback={<BlockLoader label="Loading" />}>
          <SecurityView />
        </Suspense>
      </div>
    </SiteShell>
  );
}
