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
    <LoadingShell label="Umrah bookings">
      <Title title="Umrah Bookings" badge />
      <Chips labels={["All", ...UMRAH_STAGES.map((s) => UMRAH_STAGE_LABELS[s])]} />
      <DataTable
        headers={["Reference", "Booking", "Departure", "Customer", "Pilgrims", "Total", "Payment", "Stage", ""]}
        rows={8}
        cell={{ 6: PillCell, 7: PillCell }}
      />
    </LoadingShell>
  );
}
