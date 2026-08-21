import type { Metadata } from "next";
import { VisaTypeEditor } from "../visa-type-editor";

export const metadata: Metadata = { title: "Add Visa Type" };

export default function NewVisaTypePage() {
  return <VisaTypeEditor />;
}
