import {
  EntityHead,
  Fields,
  LoadingShell,
  RailSkeleton,
  Section,
  TabBar,
} from "@/components/dashboard/admin-skeletons";

export default function PartnerLoading() {
  return (
    <LoadingShell label="partner">
      <div className="space-y-5">
        <EntityHead actions={["w-9", "w-28"]} />
        <RailSkeleton labels={["Onboarding", "Documents verified", "Team", "Went live"]} />
      </div>
      <TabBar labels={["Overview", "Onboarding", "Portfolio", "Commercial", "Documents", "Users", "Activity", "Notes"]} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Section title="Contact">
          <Fields labels={["Primary contact", "Email", "Phone", "Approved by"]} cols={2} />
        </Section>
        <Section title="Key dates">
          <Fields labels={["Application submitted", "Approved", "Went live", "Account ID"]} cols={2} />
        </Section>
      </div>
      <Section title="Business">
        <Fields labels={["Legal business name", "Trading name", "Business type", "Registration number"]} cols={2} />
      </Section>
    </LoadingShell>
  );
}
