import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { LoadingShell, Title } from "@/components/dashboard/admin-skeletons";

export default function PrivateUmrahServicesLoading() {
  return (
    <LoadingShell label="Private Umrah services" className="space-y-8">
      <div className="space-y-5">
        <Skeleton className="size-9 rounded-full" />
        <Title title="Private Umrah services" badge actions={["w-32"]} />
      </div>
      {[0, 1, 2].map((section) => (
        <section key={section} className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Card className="gap-0 py-0">
            <ul className="divide-y divide-border">
              {[0, 1, 2].map((i) => (
                <li key={i} className="flex items-start justify-between gap-4 px-4 py-3.5">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-72 max-w-full" />
                  </div>
                  <Skeleton className="size-8 rounded-lg" />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </LoadingShell>
  );
}
