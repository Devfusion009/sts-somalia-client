import { Skeleton } from "@/components/ui/skeleton";
import {
  LoadingShell,
  Section,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function SecurityLoading() {
  return (
    <LoadingShell label="security">
      <Title title="Security" className="font-bold" />
      <Section title="Two-Factor Authentication"><Skeleton className="h-24 w-full" /></Section>
    </LoadingShell>
  );
}
