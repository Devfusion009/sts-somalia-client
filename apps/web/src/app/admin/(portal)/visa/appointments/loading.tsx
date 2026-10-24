import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingShell, Title } from "@/components/dashboard/admin-skeletons";

function Rows({ n }: { n: number }) {
  return (
    <Card className="py-0">
      <CardContent className="divide-y divide-border px-4 sm:px-6">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
            <Skeleton className="h-5 w-14" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-full sm:w-48" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function VisaAppointmentsLoading() {
  return (
    <LoadingShell label="visa appointments">
      <Title title="Visa appointments" badge />
      <section className="space-y-3">
        <Skeleton className="h-5 w-44" />
        <Rows n={3} />
      </section>
      <section className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Rows n={2} />
      </section>
    </LoadingShell>
  );
}
