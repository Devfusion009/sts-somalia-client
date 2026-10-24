import { Chips, DataTable, LoadingShell, PillCell, Title } from "@/components/dashboard/admin-skeletons";

export default function UmrahDeparturesLoading() {
  return (
    <LoadingShell label="Umrah departures">
      <Title title="Umrah Departures" actions={["w-40"]} />
      <Chips labels={["Upcoming", "Last 6 months"]} />
      <DataTable
        headers={["Departure", "Package", "Booked", "Offline", "Free", "Pilgrims ready", "Outstanding", "Status", ""]}
        rows={8}
        cell={{ 7: PillCell }}
      />
    </LoadingShell>
  );
}
