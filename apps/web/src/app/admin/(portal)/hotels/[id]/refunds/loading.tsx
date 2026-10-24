import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/dashboard/admin-skeletons";
import { HotelSectionLoading } from "../section-loading";

export default function HotelRefundsLoading() {
  return (
    <HotelSectionLoading label="refunds" title="Refunds">
      <Section title="Requests">
        <div className="space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-10 w-full" />
        </div>
      </Section>
      <Section title="Refund rules">
        <Skeleton className="h-32 w-full" />
      </Section>
    </HotelSectionLoading>
  );
}
