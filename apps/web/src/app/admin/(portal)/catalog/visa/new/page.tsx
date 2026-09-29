import type { Metadata } from "next";
import { getVisaCentresAdmin } from "@/modules/admin/queries";
import { VisaTypeEditor } from "../visa-type-editor";

export const metadata: Metadata = { title: "Add Visa Type" };

export default async function NewVisaTypePage() {
  const centres = await getVisaCentresAdmin();
  return <VisaTypeEditor centres={centres} />;
}
