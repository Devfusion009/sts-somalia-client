import { Skeleton } from "@/components/ui/skeleton";
import { FormFields, Section } from "@/components/dashboard/admin-skeletons";

const SECTIONS: Array<{ title: string; labels: string[] }> = [
  { title: "Basic information", labels: ["Country", "Currency", "Name", "Category"] },
  { title: "Cover image", labels: [] },
  { title: "Price & processing", labels: ["Price", "Internal processing fee", "Visa validity (days)", "Max stay per visit (days)"] },
  { title: "Case workflow", labels: ["Handling target (days)"] },
  { title: "Required documents", labels: [] },
  { title: "Application questions", labels: [] },
  { title: "Eligibility & terms", labels: ["Eligibility requirements", "Terms & conditions"] },
  { title: "Visibility", labels: ["Status"] },
];

/** Static frame of the visa type editor, shared by the add and edit routes. */
export function VisaEditorLoading({ title }: { title?: string }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-5">
        <Skeleton className="size-9 rounded-full" />
        {title ? (
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-7 w-56" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-40" />
          </div>
        )}
      </div>
      {SECTIONS.map((s) => (
        <Section key={s.title} title={s.title}>
          {s.labels.length > 0 ? <FormFields labels={s.labels} cols={2} /> : <Skeleton className="h-24 w-full" />}
        </Section>
      ))}
    </div>
  );
}
