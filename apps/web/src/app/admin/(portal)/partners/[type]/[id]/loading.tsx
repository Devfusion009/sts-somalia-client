import {
  DetailHead,
  Fields,
  LoadingShell,
  Section,
  TabBar,
} from "@/components/dashboard/admin-skeletons";

export default function PartnerLoading() {
  return (
    <LoadingShell label="partner">
      <DetailHead badges={2} actions={["w-28"]} />
      <TabBar labels={["Overview","Onboarding","Portfolio","Commercial","Documents","Users","Activity Log","Internal Notes"]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Contact"><Fields labels={["Primary contact", "Email", "Phone", "Approved by"]} /></Section>
        <Section title="Key dates"><Fields labels={["Created", "Went live", "Last updated"]} /></Section>
      </div>
    </LoadingShell>
  );
}
