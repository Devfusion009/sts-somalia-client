import { Skeleton } from "@/components/ui/skeleton";
import {
  DetailHead,
  FormFields,
  Gallery,
  LoadingShell,
  Section,
} from "@/components/dashboard/admin-skeletons";

export default function UmrahPackageLoading() {
  return (
    <LoadingShell label="Umrah package">
      <DetailHead badges={2} actions={["w-28"]} />
      <Gallery />
      <Section title="Package details"><FormFields labels={["Name", "Slug", "Duration", "Description"]} button="x" /></Section>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Hotels"><Skeleton className="h-24 w-full" /></Section>
        <Section title="Rate card"><Skeleton className="h-24 w-full" /></Section>
      </div>
      <Section title="Day-by-day plan"><Skeleton className="h-32 w-full" /></Section>
      <Section title="Local agencies"><Skeleton className="h-16 w-full" /></Section>
      <Section title="Departures"><Skeleton className="h-24 w-full" /></Section>
    </LoadingShell>
  );
}
