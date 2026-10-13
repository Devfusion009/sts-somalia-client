import { Skeleton } from "@/components/ui/skeleton";
import { VisaEditorLoading } from "../../visa-editor-loading";
import {
  LoadingShell,
  Section,
} from "@/components/dashboard/admin-skeletons";

export default function VisaTypeLoading() {
  return (
    <LoadingShell label="visa type">
      <VisaEditorLoading title="Edit visa type" />
      <Section title="Nationality overrides"><Skeleton className="h-20 w-full" /></Section>
    </LoadingShell>
  );
}
