import { VisaEditorLoading } from "../visa-editor-loading";
import {
  LoadingShell,
} from "@/components/dashboard/admin-skeletons";

export default function VisaTypeLoading() {
  return (
    <LoadingShell label="visa type">
      <VisaEditorLoading title="Add visa type" />
    </LoadingShell>
  );
}
