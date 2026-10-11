"use client";

import { Suspense } from "react";
import { useStore } from "@/lib/store";
import { DirectoryView } from "@/components/DirectoryView";
import { NoAccess, PageTitle } from "@/components/console/ui";
import { BlockLoader } from "@/components/ui/Spinner";

export default function Page() {
  const { can } = useStore();
  if (!can("directory.view")) return <NoAccess need="directory.view" />;
  return (
    <>
      <PageTitle title="Registers" sub="Every verified player, club, coach, scout, official and facility in your scope. Personal identifiers stay in the application record." />
      <Suspense fallback={<BlockLoader label="Loading the register" />}>
        <div className="[&>div]:!px-0 [&>div>div]:!mt-0">
          <DirectoryView scope="staff" initialTab="players" />
        </div>
      </Suspense>
    </>
  );
}
