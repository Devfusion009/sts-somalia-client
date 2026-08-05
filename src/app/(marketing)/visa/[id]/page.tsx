import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileCheck2,
  Home,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getVisaTypeById } from "@/modules/visa/queries";
import { startVisaApplication } from "@/modules/visa/actions";
import { parseDocumentSlots } from "@/modules/visa/schemas";
import { countryFlag, countryName } from "@/lib/countries";
import { VisaTypeBanner, fmtMoney, processingText } from "@/modules/visa/components/visa-shared";
import { SubmitButton } from "@/components/submit-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const visa = await getVisaTypeById(id);
  return { title: visa?.name ?? "Visa Service" };
}

const HOW_IT_WORKS = [
  {
    icon: ClipboardList,
    title: "Fill the application",
    text: "Complete the guided online form — for yourself, your family, or a group.",
  },
  {
    icon: FileCheck2,
    title: "Upload documents",
    text: "Attach clear scans of the required documents; our team reviews every file.",
  },
  {
    icon: CreditCard,
    title: "Pay securely",
    text: "Pay by card, mobile money, or bank transfer — whatever suits you.",
  },
  {
    icon: Send,
    title: "We handle the rest",
    text: "STS submits to the immigration authority and you track progress in real time.",
  },
];

export default async function VisaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const visa = await getVisaTypeById(id);
  if (!visa) notFound();

  const slots = parseDocumentSlots(visa.required_documents);
  const destination = countryName(visa.destination_country_code);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="flex items-center gap-1 hover:text-foreground">
          <Home className="size-3.5" /> Home
        </Link>
        <ChevronRight className="size-3" />
        <Link href="/visa" className="hover:text-foreground">
          Visa
        </Link>
        <ChevronRight className="size-3" />
        <span className="font-medium text-foreground">{destination}</span>
      </nav>

      <VisaTypeBanner
        visaType={visa}
        right={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Price From</p>
              <p className="font-heading text-xl font-bold text-primary">
                {fmtMoney(visa.price, visa.currency)}
              </p>
            </div>
          </div>
        }
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <section>
            <h2 className="font-heading text-xl font-bold">About this visa</h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {visa.overview ?? visa.description ?? `Apply online for the ${visa.name} with STS.`}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["Entries", visa.entry_type === "multiple" ? "Multiple" : "Single"],
                ["Validity", visa.validity_days ? `${visa.validity_days} Days` : "Varies"],
                ["Max Stay", visa.stay_days ? `${visa.stay_days} Days` : "Varies"],
                ["Processing", processingText(visa)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-card p-4">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-sm font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold">Required documents</h2>
            <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {slots.map((slot) => (
                <li key={slot.key} className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3.5">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-semibold">
                      {slot.label}
                      {!slot.required ? (
                        <span className="font-normal text-muted-foreground"> (optional)</span>
                      ) : null}
                    </p>
                    {slot.description ? (
                      <p className="text-xs text-muted-foreground">{slot.description}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-xl font-bold">How it works</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map((item, i) => (
                <div key={item.title} className="relative rounded-xl border border-border bg-card p-4">
                  <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
                    <item.icon className="size-4" />
                  </span>
                  <p className="mt-3 text-sm font-bold">
                    {i + 1}. {item.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-2xl leading-none">{countryFlag(visa.destination_country_code)}</span>
                {visa.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Government &amp; service fee</span>
                <span className="font-semibold">{fmtMoney(visa.price, visa.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Per applicant</span>
                <span className="font-semibold">Yes</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base">
                <span className="font-semibold">Total from</span>
                <span className="font-heading font-bold text-primary">
                  {fmtMoney(visa.price, visa.currency)}
                </span>
              </div>
              <form action={startVisaApplication} className="pt-2">
                <input type="hidden" name="visaTypeId" value={visa.id} />
                <SubmitButton size="lg" className="w-full gap-2" pendingText="Starting application…">
                  Apply Now <ArrowRight className="size-4" />
                </SubmitButton>
              </form>
              <p className="text-center text-xs text-muted-foreground">
                Sign in required — your progress is saved automatically.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
