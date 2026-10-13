import {
  DataTable,
  LoadingShell,
  PillCell,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function EventsLoading() {
  return (
    <LoadingShell label="events" className="space-y-8">
      <Title title="Events &amp; Halls" actions={["w-32"]} />
      <section className="space-y-3"><h2 className="font-heading text-lg font-semibold">Venues</h2><DataTable headers={["Venue","City","Capacity","Price","Status","Actions"]} rows={5} cell={{ 4: PillCell }} /></section>
      <section className="space-y-3"><h2 className="font-heading text-lg font-semibold">Hall bookings</h2><DataTable headers={["Reference","Venue","Customer","Event","Guests","Price","Status"]} rows={5} cell={{ 6: PillCell }} /></section>
    </LoadingShell>
  );
}
