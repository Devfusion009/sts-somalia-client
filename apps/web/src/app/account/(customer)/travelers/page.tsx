import type { Metadata } from "next";
import Link from "next/link";
import { getServerTrpc } from "@/lib/trpc/server";
import { TravelerManager } from "@/modules/travelers/components/traveler-manager";
import { PassportExpiryAlert } from "@/modules/travelers/components/passport-alert";
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
  const companions = travelers.filter((t) => !t.is_self);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Saved Travelers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The people you book for. Your own details live on the{" "}
          <Link href="/account" className="font-medium text-primary hover:underline">
            Overview
          </Link>{" "}
          page.
        </p>
      </div>

      {/* One alert per companion whose passport needs attention. Rendered here
          rather than only inside each card so the warnings are impossible to
          miss on a page that may list a dozen people. */}
      {companions.map((traveler) => (
        <PassportExpiryAlert
          key={traveler.id}
          expiry={traveler.passport_expiry}
          subject={`${traveler.full_name}'s passport`}
        />
      ))}

      <TravelerManager travelers={travelers} />
    </div>
  );
}
