import { notFound } from "next/navigation";
import { getHotelAccess } from "@/modules/hotels/hotel-access";
import { ReportsView } from "@/modules/hotels/views/reports-view";

export const metadata = { title: "Reports" };

export default async function ManagerReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ hotelId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { hotelId } = await params;
  const { range } = await searchParams;
  const access = await getHotelAccess(hotelId);
  if (!access || !access.can("bookings")) notFound();
  return <ReportsView hotelId={hotelId} base={`/manager/${hotelId}`} range={range} />;
}
