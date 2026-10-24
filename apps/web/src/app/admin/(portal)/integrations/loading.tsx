import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingShell, Title } from "@/components/dashboard/admin-skeletons";
import { cn } from "@/lib/utils";

const TABS = ["Payments", "Flights", "Hotels", "Visa", "Visa processing", "Built-in"];

export default function IntegrationsLoading() {
  return (
    <LoadingShell label="integrations">
      <Title title="Integrations" />
      <div className="-mx-4 flex gap-x-1 overflow-hidden border-b px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-hidden>
        {TABS.map((label, i) => (
          <span
            key={label}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap",
              i === 0 ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            )}
          >
            {label}
            <Skeleton className="h-5 w-8 rounded-full" />
          </span>
        ))}
      </div>
      {["Cards", "Mobile money"].map((group) => (
        <section key={group} className="space-y-3">
          <h2 className="font-heading text-base font-semibold">{group}</h2>
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <Card key={i}>
                <CardContent className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div className="max-w-3xl space-y-3">
                    <p className="text-sm font-medium">Credentials</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Skeleton className="h-8 w-full rounded-lg" />
                      <Skeleton className="h-8 w-full rounded-lg" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 border-t pt-4">
                    <Skeleton className="h-7 w-32 rounded-lg" />
                    <Skeleton className="h-7 w-36 rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </LoadingShell>
  );
}
