import { BackLink } from "@/components/back-link";
import { FormFields, Section } from "@/components/dashboard/admin-skeletons";

const SECTIONS: Array<{ title: string; labels: string[] }> = [
  { title: "Basic information", labels: ["Country", "Name", "Visa category", "Description"] },
  { title: "Cover image", labels: [] },
  { title: "Price & processing", labels: ["Price", "Currency", "Processing time", "Validity", "Entries", "Stay length"] },
  { title: "Case workflow", labels: ["Processing mode", "Assigned team"] },
  { title: "Required documents", labels: [] },
  { title: "Application questions", labels: [] },
  { title: "Eligibility & terms", labels: ["Eligibility", "Terms"] },
  { title: "Visibility", labels: ["Status"] },
];

/** Static frame of the visa type editor, shared by the add and edit routes. */
export function VisaEditorLoading({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/admin/catalog/visa" label="All visa types" />
        <div className="mt-2">
          <h1 className="font-heading text-2xl font-semibold">{title}</h1>
        </div>
      </div>
      {SECTIONS.map((s) => (
        <Section key={s.title} title={s.title}>
          <FormFields labels={s.labels} cols={2} />
        </Section>
      ))}
    </div>
  );
}
