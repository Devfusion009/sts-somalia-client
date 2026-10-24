import {
  Chips,
  DataTable,
  LoadingShell,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function AuditLogLoading() {
  return (
    <LoadingShell label="audit log">
      <Title title="Audit Log" badge />
      <Chips labels={["All","My activity"]} />
      <DataTable headers={["When","Actor","Action","Entity","Details"]} rows={10} />
    </LoadingShell>
  );
}
