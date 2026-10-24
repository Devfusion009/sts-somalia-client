import { Skeleton } from "@/components/ui/skeleton";
import { Chips, RailSkeleton, Section } from "@/components/dashboard/admin-skeletons";
import { REPORT_RANGES } from "@/modules/hotels/report-queries";
import { HotelSectionLoading } from "../section-loading";

const RAIL = ["Revenue", "Bookings", "Room nights", "Avg. nightly rate", "Occupancy", "Confirmed stays", "Cancellation rate", "No-shows"];

export default function HotelReportsLoading() {
  return (
    <HotelSectionLoading label="reports" title="Reports">
      <Chips labels={REPORT_RANGES.map((r) => r.label)} />
      <RailSkeleton labels={RAIL} />
      <Section title="Occupancy by night">
        <Skeleton className="h-40 w-full" />
      </Section>
    </HotelSectionLoading>
  );
}
