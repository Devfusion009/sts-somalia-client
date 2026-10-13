import {
  Chips,
  DataTable,
  LoadingShell,
  PillCell,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function UmrahBookingsLoading() {
  return (
    <LoadingShell label="Umrah bookings">
      <Title title="Umrah Bookings" />
      <Chips size="sm" labels={["All","Booked","Confirmed","Visa processing","Visa issued","Travel confirmed","Documents ready","Completed"]} />
      <DataTable headers={["Reference","Booking","Departure","Customer","Pilgrims","Total","Payment","Stage"]} rows={8} cell={{ 6: PillCell, 7: PillCell }} />
    </LoadingShell>
  );
}
