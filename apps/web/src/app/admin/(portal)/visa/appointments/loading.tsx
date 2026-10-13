import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  LoadingShell,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function VisaAppointmentsLoading() {
  return (
    <LoadingShell label="visa appointments">
      <Title title="Visa appointments" />
      <section className="space-y-3"><h2 className="font-heading text-base font-semibold text-destructive">Outcome not recorded</h2><Card className="py-0"><CardContent className="space-y-3 px-4 py-3">{[0, 1].map((i) => (<Skeleton key={i} className="h-10 w-full" />))}</CardContent></Card></section>
      <section className="space-y-3"><Skeleton className="h-5 w-40" /><Card className="py-0"><CardContent className="space-y-3 px-4 py-3">{[0, 1, 2].map((i) => (<Skeleton key={i} className="h-10 w-full" />))}</CardContent></Card></section>
    </LoadingShell>
  );
}
