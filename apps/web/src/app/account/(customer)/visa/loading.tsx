import { LoadingShell, Title } from "@/components/dashboard/admin-skeletons";
import { ListCardSkeleton } from "../list-skeleton";

export default function Loading() {
  return (
    <LoadingShell label="visa applications" className="mx-auto w-full max-w-5xl">
      <Title title="Visa applications" badge actions={["w-40"]} />
      <ListCardSkeleton rows={3} />
    </LoadingShell>
  );
}
