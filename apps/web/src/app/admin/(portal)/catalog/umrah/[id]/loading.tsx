import { Skeleton } from "@/components/ui/skeleton";
import { FormFields, Gallery, LoadingShell, RailSkeleton, Section } from "@/components/dashboard/admin-skeletons";

const RAIL = ["Starting price", "Departures", "Seats left", "Rate card"];

export default function UmrahPackageLoading() {
  return (
    <LoadingShell label="Umrah package">
      <div className="space-y-5">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-64 max-w-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
        <RailSkeleton labels={RAIL} />
      </div>
      <Gallery />
      <Section title="Package details">
        <FormFields labels={["Tagline", "Tier badge", "From (airport)", "To (airport)"]} cols={2} button="x" />
      </Section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Hotels">
          <Skeleton className="h-24 w-full" />
        </Section>
        <Section title="Rate card">
          <Skeleton className="h-24 w-full" />
        </Section>
      </div>
      <Section title="Day-by-day plan">
        <Skeleton className="h-32 w-full" />
      </Section>
      <Section title="Local agencies">
        <Skeleton className="h-16 w-full" />
      </Section>
      <Section title="Departures">
        <Skeleton className="h-24 w-full" />
      </Section>
    </LoadingShell>
  );
}
