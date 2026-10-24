import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { EntityHead, LoadingShell, TabBar } from "@/components/dashboard/admin-skeletons";

const FACTS = ["In stage", "Documents", "Payment", "Travellers", "Due"];

export default function VisaApplicationLoading() {
  return (
    <LoadingShell label="visa application">
      <div className="space-y-5">
        <EntityHead actions={["w-20", "w-48", "w-20"]} />
        <dl className="flex flex-wrap gap-x-8 gap-y-3 rounded-xl bg-secondary/40 px-4 py-3">
          {FACTS.map((label) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd>
                <Skeleton className="mt-1 h-5 w-16" />
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <TabBar
        labels={["Overview", "Applicant", "Documents", "Submission", "Decision", "Payment", "Messages", "Notes", "Activity"]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-5">
            <h2 className="font-heading text-base font-semibold">Next step</h2>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-32 rounded-lg" />
              <Skeleton className="h-8 w-36 rounded-lg" />
            </div>
            <div className="divide-y divide-border">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 py-2.5">
                  <Skeleton className="size-4 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-heading text-base font-semibold">Recent activity</h2>
            <div className="divide-y divide-border">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start justify-between gap-4 py-2.5">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-56 max-w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </LoadingShell>
  );
}
