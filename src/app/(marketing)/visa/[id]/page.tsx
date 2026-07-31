import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getVisaTypeById } from "@/lib/data/visa";
import { countryName } from "@/lib/countries";
import { ApplyForm } from "./apply-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const visa = await getVisaTypeById(id);
  return { title: visa?.name ?? "Visa Service" };
}

export default async function VisaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const visa = await getVisaTypeById(id);
  if (!visa) notFound();

  const requiredDocuments = Array.isArray(visa.required_documents)
    ? (visa.required_documents as unknown[]).filter((d): d is string => typeof d === "string")
    : [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="size-6" />
          </span>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {countryName(visa.destination_country_code)}
          </p>
          <h1 className="font-heading text-3xl font-semibold">{visa.name}</h1>
          {visa.description ? <p className="mt-3 text-muted-foreground">{visa.description}</p> : null}

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Badge variant="secondary" className="gap-1.5 py-1.5 text-sm">
              <span className="font-semibold text-foreground">
                {visa.currency} {visa.price.toFixed(0)}
              </span>
            </Badge>
            {visa.processing_days_min ? (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-4" />
                Processing: {visa.processing_days_min}
                {visa.processing_days_max && visa.processing_days_max !== visa.processing_days_min
                  ? `–${visa.processing_days_max}`
                  : ""}{" "}
                days
              </span>
            ) : null}
          </div>

          {requiredDocuments.length > 0 ? (
            <Card className="mt-8">
              <CardContent className="p-6">
                <h2 className="font-heading text-lg font-semibold">Required documents</h2>
                <ul className="mt-3 space-y-2">
                  {requiredDocuments.map((doc) => (
                    <li key={doc} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="size-4 shrink-0 text-primary" />
                      {doc.replace(/_/g, " ")}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="lg:col-span-2">
          <ApplyForm visaTypeId={visa.id} />
        </div>
      </div>
    </div>
  );
}
