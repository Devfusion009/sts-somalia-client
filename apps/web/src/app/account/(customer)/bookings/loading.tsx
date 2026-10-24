import { Chips, LoadingShell, Title } from "@/components/dashboard/admin-skeletons";
import { ListCardSkeleton } from "../list-skeleton";

export default function Loading() {
  return (
    <LoadingShell label="bookings" className="mx-auto w-full max-w-5xl">
      <Title title="My bookings" actions={["w-36"]} />
      <Chips labels={["Upcoming", "Past", "Cancelled", "All"]} counts />
      <ListCardSkeleton rows={4} />
    </LoadingShell>
  );
}
