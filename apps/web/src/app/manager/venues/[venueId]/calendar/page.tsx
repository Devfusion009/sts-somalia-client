import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueCalendarView } from "@/modules/events/views/venue-calendar-view";

export const metadata = { title: "Calendar" };

export default async function VenueCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ venueId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ venueId }, { month }] = await Promise.all([params, searchParams]);
  const access = await getVenueAccess(venueId);
  if (!access) notFound();
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="Calendar" />
      <VenueCalendarView venueId={venueId} base={`/manager/venues/${venueId}`} access={access} month={month} />
    </div>
  );
}
