import { Skeleton } from "@/components/ui/skeleton";
import {
  LoadingShell,
  Section,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function SecurityLoading() {
  return (
    <LoadingShell label="security" className="max-w-2xl">
      <Title title="Security" />
      <Section title="Two-factor authentication">
        <Skeleton className="h-8 w-48 rounded-lg max-sm:h-10" />
      </Section>
    </LoadingShell>
  );
}
