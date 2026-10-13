import {
  CountRail,
  DataTable,
  LoadingShell,
  Pager,
  PillCell,
  QueueGroups,
  SearchBar,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function VisaApplicationsLoading() {
  return (
    <LoadingShell label="visa applications">
      <Title title="Visa applications" />
      <SearchBar placeholder="Reference, name, email, ref no." selects={2} urgent />
      <CountRail labels={["Needs action","Unassigned","Due within 24h","Awaiting payment","Waiting on applicant","Processing","Passport return"]} />
      <QueueGroups groups={[{"label": "My work", "queues": ["Needs action", "Assigned to me", "Unassigned", "Due within 24h"]}, {"label": "In progress", "queues": ["Awaiting payment", "New", "Document review", "Waiting on applicant", "Appointment pending", "Ready for submission", "Processing"]}, {"label": "Closed", "queues": ["Approved", "Passport return", "Refused", "Issued", "Cancelled", "All"]}]} />
      <DataTable headers={["Applicant","Destination","Stage","Payment","Docs","Appointment","Owner","In stage","Due"]} rows={8} cell={{ 2: PillCell, 3: PillCell }} />
      <Pager />
    </LoadingShell>
  );
}
