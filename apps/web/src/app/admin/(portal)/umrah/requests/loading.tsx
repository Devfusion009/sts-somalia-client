import {
  LoadingShell,
  RequestCards,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function UmrahRequestsLoading() {
  return (
    <LoadingShell label="Umrah requests">
      <Title title="Private Umrah requests" badge className="text-xl" />
      <RequestCards rows={4} />
    </LoadingShell>
  );
}
