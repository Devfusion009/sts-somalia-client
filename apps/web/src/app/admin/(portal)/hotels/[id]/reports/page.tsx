import { requirePlatformAdmin } from "@/lib/auth/session";
import { HotelSectionHeader } from "../hotel-tabs";
import { ReportsView } from "@/modules/hotels/views/reports-view";

export const metadata = { title: "Hotel Reports" };

export default async function AdminHotelReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { id } = await params;
  const { range } = await searchParams;
  await requirePlatformAdmin();
  return (
    <div className="space-y-6">
      <HotelSectionHeader id={id} active="reports" />
      <ReportsView hotelId={id} base={`/admin/hotels/${id}`} range={range} />
    </div>
  );
}
