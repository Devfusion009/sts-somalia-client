import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVisaTypeAdmin, getVisaNationalityRulesAdmin, getVisaCentresAdmin, getVisaTypeCentreIds } from "@/modules/admin/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VisaTypeEditor } from "../../visa-type-editor";
import { NationalityRulesSection } from "../../nationality-rules-section";

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
  const [rules, centres, selectedCentreIds] = await Promise.all([
    getVisaNationalityRulesAdmin(id),
    getVisaCentresAdmin(),
    getVisaTypeCentreIds(id),
  ]);

  return (
    <div className="space-y-6">
      <VisaTypeEditor visaType={visaType} centres={centres} selectedCentreIds={selectedCentreIds} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nationality overrides</CardTitle>
        </CardHeader>
        <CardContent>
          <NationalityRulesSection visaTypeId={id} visaCurrency={visaType.currency} rules={rules} />
        </CardContent>
      </Card>
    </div>
  );
}
