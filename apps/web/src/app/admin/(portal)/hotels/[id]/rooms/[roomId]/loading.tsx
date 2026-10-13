import { Skeleton } from "@/components/ui/skeleton";
import {
  DetailHead,
  FormFields,
  Gallery,
  LoadingShell,
  Section,
} from "@/components/dashboard/admin-skeletons";

export default function RoomLoading() {
  return (
    <LoadingShell label="room">
      <DetailHead back="x" badges={1} />
      <Section title="Next 60 nights"><Skeleton className="h-40 w-full" /></Section>
      <Section title="Override dates"><FormFields labels={["From","To","Units","Price"]} button="x" cols={2} /></Section>
      <Section title="Clear overrides"><FormFields labels={["From","To"]} button="x" cols={2} /></Section>
      <Gallery title="Photos" />
    </LoadingShell>
  );
}
