import { Chips, DataTable, PillCell } from "@/components/dashboard/admin-skeletons";
import { HotelSectionLoading } from "../section-loading";

export default function HotelBookingsLoading() {
  return (
    <HotelSectionLoading label="bookings" title="Bookings">
      <Chips labels={["All", "Needs a decision", "Confirmed", "Completed", "Cancelled"]} counts />
      <DataTable headers={["Guest", "Room", "Dates", "Rooms", "Price", "Payment", "Status", ""]} rows={8} cell={{ 6: PillCell }} />
    </HotelSectionLoading>
  );
}
