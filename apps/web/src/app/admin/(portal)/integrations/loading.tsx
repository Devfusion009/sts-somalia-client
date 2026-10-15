import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingShell, Title } from "@/components/dashboard/admin-skeletons";
import { cn } from "@/lib/utils";

const TABS = ["Payments", "Flights", "Hotels", "Visa", "Visa processing", "Built-in"];

export default function IntegrationsLoading() {
  return (
    <LoadingShell label="integrations">
      <Title title="Integrations" />
      <nav className="-mb-px flex flex-wrap gap-x-1 border-b" aria-hidden>
        {TABS.map((label, i) => (
          <span
            key={label}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium",
              i === 0 ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            )}
          >
            {label}
            <Skeleton className="h-4 w-8 rounded-full" />
          </span>
        ))}
      </nav>
      {["Cards", "Mobile money"].map((group) => (
        <section key={group} className="space-y-3">
          <h2 className="font-heading text-base font-semibold">{group}</h2>
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardContent className="space-y-5 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-5 w-28 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
                <div className="max-w-3xl rounded-lg border bg-muted/30 p-4">
                  <Skeleton className="mb-3 h-4 w-24" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-9 w-full rounded-lg" />
                    <Skeleton className="h-9 w-full rounded-lg" />
                  </div>
                </div>
                <div className="flex gap-2 border-t pt-4">
                  <Skeleton className="h-8 w-36 rounded-lg" />
                  <Skeleton className="h-8 w-32 rounded-lg" />
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      ))}
    </LoadingShell>
  );
}
