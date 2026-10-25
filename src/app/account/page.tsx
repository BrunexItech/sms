import { AccountView } from "@/components/AccountView";
import { SiteShell } from "@/components/SiteShell";

export const metadata = { title: "My registration | National Sports Registry, Kenya" };

export default function AccountPage() {
  return (
    <SiteShell>
      <div className="bg-bone pt-8"><AccountView /></div>
    </SiteShell>
  );
}
