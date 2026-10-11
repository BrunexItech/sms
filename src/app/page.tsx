import { Compliance } from "@/components/Compliance";
import { FacilityMap } from "@/components/FacilityMap";
import { Hero } from "@/components/Hero";
import { HomeDashboard } from "@/components/HomeDashboard";
import { RunBy } from "@/components/RunBy";
import { SiteShell } from "@/components/SiteShell";
import { SportsGrid } from "@/components/SportsGrid";

export default function Home() {
  return (
    <SiteShell chat={false}>
      <Hero />
      <HomeDashboard />
      <SportsGrid />
      <FacilityMap />
      <Compliance />
      <RunBy />
    </SiteShell>
  );
}
