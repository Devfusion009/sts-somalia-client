import {
  DetailHead,
  Fields,
  LoadingShell,
  Section,
  TabBar,
} from "@/components/dashboard/admin-skeletons";

export default function VisaApplicationLoading() {
  return (
    <LoadingShell label="visa application">
      <DetailHead back="x" badges={2} actions={["w-28","w-28"]} />
      <TabBar labels={["Overview","Applicant","Documents","Submission","Decision","Payment","Messages","Notes","Activity"]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Application"><Fields labels={["Reference", "Destination", "Visa type", "Submitted"]} /></Section>
        <Section title="Applicant"><Fields labels={["Name", "Email", "Phone", "Nationality"]} /></Section>
      </div>
    </LoadingShell>
  );
}
