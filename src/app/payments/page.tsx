import { PaymentsView } from "@/components/PaymentsView";
import { PageHero, SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Payments | National Sports Registry, Kenya" };

export default function PaymentsPage() {
  return (
    <SiteShell>
      <PageHero eyebrow="Registration payments" title={<>Pay, and get your <em className="text-gold">receipt.</em></>}>
        Settle a pending registration or check the status of a payment using your reference number.
      </PageHero>
      <div className="bg-bone pt-12"><PaymentsView /></div>
    </SiteShell>
  );
}
