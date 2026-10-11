import { Suspense } from "react";
import { RegistrationFlow } from "@/components/RegistrationFlow";
import { PageHero, SiteShell } from "@/components/SiteShell";
import { BlockLoader } from "@/components/ui/Spinner";

export const metadata = { title: "Register | National Sports Registry, Kenya" };

export default function RegisterPage() {
  return (
    <SiteShell>
      <PageHero eyebrow="Sports stakeholder onboarding" title={<>Register on the <em className="text-gold">national record.</em></>}>
        Identity, location, sport and payment in four steps. Players, clubs, academies, coaches, scouts, agents,
        businesses, facility operators, organisers and federations.
      </PageHero>
      <div className="bg-bone pt-12">
        <Suspense fallback={<BlockLoader label="Preparing the registration form" />}>
          <RegistrationFlow />
        </Suspense>
      </div>
    </SiteShell>
  );
}
