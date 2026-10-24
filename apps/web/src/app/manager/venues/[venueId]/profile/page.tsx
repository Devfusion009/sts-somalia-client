import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedVenue, getVenueForManager, hasVenuePermission } from "@/modules/events/venue-manager-queries";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ManagerVenueProfileForm } from "./profile-form";

export const metadata = { title: "Venue Profile" };

export default async function ManagerVenueProfilePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const profile = await requireUser();
  const managed = await getMyManagedVenue(profile.id, venueId);
  if (!managed || !hasVenuePermission(managed, "profile")) notFound();

  const venue = await getVenueForManager(venueId);
  if (!venue) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Venue profile" />
      <Card>
        <CardContent>
          <ManagerVenueProfileForm
            venue={{
              id: venue.id,
              tagline: venue.tagline,
              description: venue.description,
              address: venue.address,
              phone: venue.phone,
              contact_email: venue.contact_email,
              policies: venue.policies,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
