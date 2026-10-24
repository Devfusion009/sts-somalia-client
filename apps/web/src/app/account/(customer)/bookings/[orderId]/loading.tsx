import { LoadingShell, RailSkeleton } from "@/components/dashboard/admin-skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function RowsCard({ title, rows }: { title: string; rows: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ul className="divide-y divide-border border-t border-border">
          {Array.from({ length: rows }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3.5 w-1/3" />
              </div>
              <Skeleton className="size-8 rounded-lg" />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function Loading() {
  return (
    <LoadingShell label="booking" className="mx-auto w-full max-w-6xl">
      <Skeleton className="size-9 rounded-full max-sm:size-10" />
      <div className="space-y-2">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-40" />
      </div>
      <RailSkeleton labels={["Total", "Paid"]} className="sm:grid-cols-2" />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-5 sm:flex-row">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex flex-1 items-center gap-3 sm:flex-col sm:items-start">
                    <Skeleton className="size-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <RowsCard title="Itinerary" rows={2} />
        </div>
        <div className="space-y-6">
          <RowsCard title="Documents" rows={2} />
          <RowsCard title="Payments" rows={1} />
        </div>
      </div>
    </LoadingShell>
  );
}
