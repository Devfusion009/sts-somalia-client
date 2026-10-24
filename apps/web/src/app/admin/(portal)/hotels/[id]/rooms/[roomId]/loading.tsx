import { Skeleton } from "@/components/ui/skeleton";
import { FormFields, Gallery, LoadingShell, RailSkeleton, Section } from "@/components/dashboard/admin-skeletons";

const RAIL = ["Rooms", "Sleeps", "Base rate", "Photos"];

export default function RoomLoading() {
  return (
    <LoadingShell label="room" className="mx-auto max-w-4xl">
      <div className="space-y-5">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <RailSkeleton labels={RAIL} />
      </div>
      <Section title="Next 60 nights">
        <Skeleton className="h-64 w-full" />
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Override dates">
          <FormFields labels={["From", "To (inclusive)", "Rooms to sell", "Price per night"]} button="x" cols={2} />
        </Section>
        <Section title="Clear overrides">
          <FormFields labels={["From", "To (inclusive)"]} button="x" cols={2} />
        </Section>
      </div>
      <Gallery title="Photos" />
    </LoadingShell>
  );
}
