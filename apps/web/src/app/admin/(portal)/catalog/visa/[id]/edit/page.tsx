import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVisaTypeAdmin } from "@/modules/admin/queries";
import { VisaTypeEditor } from "../../visa-type-editor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const visaType = await getVisaTypeAdmin(id);
  return { title: visaType ? `Edit ${visaType.name}` : "Edit Visa Type" };
}

export default async function EditVisaTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const visaType = await getVisaTypeAdmin(id);
  if (!visaType) notFound();

  return <VisaTypeEditor visaType={visaType} />;
}
