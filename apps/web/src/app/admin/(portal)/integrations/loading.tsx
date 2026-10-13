import { Skeleton } from "@/components/ui/skeleton";
import {
  Fields,
  LoadingShell,
  Section,
  Title,
} from "@/components/dashboard/admin-skeletons";

export default function IntegrationsLoading() {
  return (
    <LoadingShell label="integrations">
      <Title title="Integrations" className="text-xl" />
      <Section title="Built-in"><div className="space-y-3"><Skeleton className="h-5 w-40" /><Fields cols={2} labels={["Civil source","Country","Islamic source"]} /></div></Section>
    </LoadingShell>
  );
}
