import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/dashboard/admin-skeletons";
import { HotelSectionLoading } from "../section-loading";

export default function HotelRatesLoading() {
  return (
    <HotelSectionLoading label="rates" title="Rates">
      <Section title="Next 14 nights">
        <Skeleton className="h-32 w-full" />
      </Section>
      <Section title="Rate rules">
        <Skeleton className="h-40 w-full" />
      </Section>
    </HotelSectionLoading>
  );
}
