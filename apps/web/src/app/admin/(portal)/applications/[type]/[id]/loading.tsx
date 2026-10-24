import { Skeleton } from "@/components/ui/skeleton";
import {
  EntityHead,
  Fields,
  FormFields,
  LoadingShell,
  RailSkeleton,
  Section,
} from "@/components/dashboard/admin-skeletons";

export default function ApplicationLoading() {
  return (
    <LoadingShell label="application">
      <div className="space-y-5">
        <EntityHead logo />
        <RailSkeleton labels={["Submitted by", "Account email", "Authorized contact", "Documents"]} />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Section title="Business">
            <Fields labels={["Legal business name", "Trading name", "Business type", "Year established", "Registration number", "Tax ID"]} cols={2} />
          </Section>
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Authorized contact">
              <Fields labels={["Name", "Role", "Mobile", "Email"]} cols={2} />
            </Section>
            <Section title="Settlement">
              <Fields labels={["Bank name", "Account name", "Account number"]} cols={2} />
            </Section>
          </div>
          <Section title="Documents">
            <div className="divide-y divide-border">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3 py-3">
                  <Skeleton className="size-9 shrink-0 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64 max-w-full" />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
        <div className="space-y-4">
          <Section title="Review">
            <Skeleton className="h-10 w-full" />
            <div className="mt-5 space-y-2">
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </Section>
          <Section title="Assigned reviewer">
            <Skeleton className="h-8 w-full rounded-lg" />
          </Section>
          <Section title="Internal notes">
            <FormFields labels={[]} button="Save" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </Section>
        </div>
      </div>
    </LoadingShell>
  );
}
