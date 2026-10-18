import { requirePlatformAdmin } from "@/lib/auth/session";
import { HotelSectionHeader } from "../hotel-tabs";
import { GuestsView } from "@/modules/hotels/views/guests-view";

export const metadata = { title: "Hotel Guests" };

export default async function AdminHotelGuestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; channel?: string }>;
}) {
  const { id } = await params;
  const { q, channel } = await searchParams;
  await requirePlatformAdmin();
  return (
    <div className="space-y-6">
      <HotelSectionHeader id={id} active="guests" />
      <GuestsView hotelId={id} base={`/admin/hotels/${id}`} q={q} channel={channel} />
    </div>
  );
}
