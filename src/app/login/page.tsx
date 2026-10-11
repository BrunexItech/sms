import { LoginView } from "@/components/LoginView";
import { PageHero, SiteShell } from "@/components/SiteShell";

export const metadata = { title: "Sign in | National Sports Registry, Kenya" };

export default function LoginPage() {
  return (
    <SiteShell>
      <PageHero eyebrow="Sign in" title={<>Members and <em className="text-gold">staff.</em></>}>
        Track your registration, or open the console for your office.
      </PageHero>
      <div className="bg-bone pt-12"><LoginView /></div>
    </SiteShell>
  );
}
