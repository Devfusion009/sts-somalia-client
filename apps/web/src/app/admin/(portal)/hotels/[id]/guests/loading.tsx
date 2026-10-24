import { Chips, DataTable, RailSkeleton } from "@/components/dashboard/admin-skeletons";
import { HotelSectionLoading } from "../section-loading";

const RAIL = ["Guests", "Returning", "Arriving soon", "Online accounts"];

export default function HotelGuestsLoading() {
  return (
    <HotelSectionLoading label="guests" title="Guests">
      <RailSkeleton labels={RAIL} />
      <Chips labels={["All", "Online", "Agency", "Offline"]} />
      <DataTable headers={["Guest", "Stays", "Room nights", "Spent", "Last stay", "Next arrival"]} rows={8} />
    </HotelSectionLoading>
  );
}
