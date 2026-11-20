import {
  Chips,
  DataTable,
  LoadingShell,
  PillCell,
  Title,
} from "@/components/dashboard/admin-skeletons";
import { UMRAH_STAGES, UMRAH_STAGE_LABELS } from "./stages";

export default function UmrahBookingsLoading() {
  return (
    <LoadingShell label="Umrah bookings & requests">
      <Title title="Umrah bookings & requests" badge />
      <Chips labels={["All", ...UMRAH_STAGES.map((s) => UMRAH_STAGE_LABELS[s])]} />
      <DataTable
        headers={["Reference", "Booking", "Departure", "Customer", "Pilgrims", "Total", "Payment", "Action"]}
        rows={8}
        cell={{ 6: PillCell }}
      />
    </LoadingShell>
  );
}
