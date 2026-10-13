import {
  DataTable,
  LoadingShell,
  PillCell,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function VisaCentresLoading() {
  return (
    <LoadingShell label="visa centres">
      <Title title="Application centres" actions={["w-32"]} />
      <DataTable headers={["Centre","Location","Hours","Visa types","Status"]} rows={6} cell={{ 4: PillCell }} />
    </LoadingShell>
  );
}
