import type { Metadata } from "next";
import { getServerTrpc } from "@/lib/trpc/server";
import { TravelerManager } from "@/modules/travelers/components/traveler-manager";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";

export const metadata: Metadata = { title: "Saved Travelers" };

export default async function AccountTravelersPage() {
  const trpc = await getServerTrpc();
  // apps/api is a separate deployment (not yet reachable from every
  // environment) — an empty list here would read as "you have no saved
  // travelers", which may be false, so this page blocks rather than degrades.
  let travelers;
  try {
    travelers = await trpc.travelers.myTravelers.query();
  } catch {
    return <UnavailableNotice label="Saved Travelers" />;
  }

  // TravelerManager owns the page header (its "Add traveler" action opens
  // the dialog it holds) and the per-companion passport alerts.
  return (
    <div className="mx-auto w-full max-w-3xl">
      <TravelerManager travelers={travelers} />
    </div>
  );
}
