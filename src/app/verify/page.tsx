import { Suspense } from "react";
import { PageHero, SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";
import { VerifyView } from "@/components/VerifyView";

export const metadata = { title: "Verify a certificate | National Sports Registry, Kenya" };

export default function VerifyPage() {
  return (
    <SiteShell>
      <PageHero eyebrow="Public verification" title={<>Verify a <em className="text-gold">certificate.</em></>}>
        Anyone can confirm that a registration certificate is genuine and current.
      </PageHero>
      <div className="bg-bone pt-12">
        <Suspense fallback={<BlockLoader label="Loading" />}><VerifyView /></Suspense>
      </div>
    </SiteShell>
  );
}
