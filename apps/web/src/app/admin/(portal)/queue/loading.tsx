import {
  LoadingShell,
  RequestCards,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function OrderQueueLoading() {
  return (
    <LoadingShell label="Booking requests">
      <Title title="Booking requests" badge />
      <RequestCards rows={5} />
    </LoadingShell>
  );
}
