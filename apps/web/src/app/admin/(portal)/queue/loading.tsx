import {
  LoadingShell,
  RequestCards,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function OrderQueueLoading() {
  return (
    <LoadingShell label="Order queue">
      <Title title="Order Queue" badge />
      <RequestCards rows={5} />
    </LoadingShell>
  );
}
