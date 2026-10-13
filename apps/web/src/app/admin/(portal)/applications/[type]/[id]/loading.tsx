import { Skeleton } from "@/components/ui/skeleton";
import {
  DetailHead,
  Fields,
  FormFields,
  LoadingShell,
  Section,
} from "@/components/dashboard/admin-skeletons";

export default function ApplicationLoading() {
  return (
    <LoadingShell label="application">
      <DetailHead badges={1} actions={["w-32"]} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Applicant"><Fields labels={["Name", "Email", "Phone", "Country"]} cols={2} /></Section>
        <Section title="Business"><Fields labels={["Business name", "Registration", "Address", "Website"]} cols={2} /></Section>
      </div>
      <Section title="Documents"><Skeleton className="h-24 w-full" /></Section>
      <Section title="Internal notes"><FormFields labels={["Note"]} button="x" /></Section>
    </LoadingShell>
  );
}
