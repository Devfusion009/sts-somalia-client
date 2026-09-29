import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  CreditCard,
  FileCheck2,
  Headset,
  Home,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  Wallet,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { CountrySearchSelect } from "@/components/ui/country-select";
import { getVisaTypeById, getResolvedVisaPricing } from "@/modules/visa/queries";
import { startVisaApplication } from "@/modules/visa/actions";
import { parseDocumentSlots } from "@/modules/visa/schemas";
import { countryFlag, countryName, NATIONALITY_DEFAULT } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fmtMoney, processingText } from "@/modules/visa/components/visa-shared";
import { SubmitButton } from "@/components/submit-button";
import { whatsappLink } from "@/lib/whatsapp";

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

const SIDEBAR_ASSURANCES = [
  { icon: ShieldCheck, text: "Documents checked before they reach the consulate" },
  { icon: Timer, text: "Real-time tracking on your account" },
  { icon: Sparkles, text: "Family & group applications handled together" },
];

export default async function VisaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nationality?: string }>;
}) {
  const { id } = await params;
  const { nationality } = await searchParams;
  const visa = await getVisaTypeById(id);
  if (!visa) notFound();

  // A nationality in the URL means the customer chose it before seeing a
  // price — resolve_visa_pricing is the same function the wizard freezes a
  // snapshot from later, so this preview can never quote a different number
  // than what they're actually charged.
  const resolved = nationality ? await getResolvedVisaPricing(visa.id, nationality) : null;
  const price = resolved?.price ?? visa.price;
  const processingFee = resolved?.processing_fee ?? visa.processing_fee;
  const slots = parseDocumentSlots(resolved?.required_documents ?? visa.required_documents);
  const destination = countryName(visa.destination_country_code);
  const total = Number(price) + Number(processingFee ?? 0);

  const specRows = [
    { icon: Clock3, label: "Processing time", value: processingText(visa) },
    { icon: CalendarCheck2, label: "Validity", value: visa.validity_days ? `${visa.validity_days} days` : "Varies" },
    { icon: CalendarRange, label: "Max stay", value: visa.stay_days ? `${visa.stay_days} days` : "Varies" },
    { icon: Wallet, label: nationality ? "Price for you" : "Starting price", value: fmtMoney(price, visa.currency) },
  ];

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

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 lg:p-8">
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-primary/5 blur-3xl" aria-hidden />
        <div className="absolute -bottom-24 left-1/3 size-64 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden />

        <div className="relative flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
            <span className="text-base leading-none">{countryFlag(NATIONALITY_DEFAULT)}</span>
            <ArrowRight className="size-3.5 text-primary" />
            <span className="text-base leading-none">{countryFlag(visa.destination_country_code)}</span>
            <span className="text-sm font-semibold">{destination}</span>
          </div>
          <Badge className="border-transparent bg-primary/10 text-primary">Licensed Somali travel agency</Badge>
        </div>

        <h1 className="relative mt-4 font-heading text-2xl font-bold tracking-tight sm:text-3xl">{visa.name}</h1>
        <p className="relative mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {visa.overview ?? visa.description ?? `Apply online for the ${visa.name} with STS.`}
        </p>

        <div className="relative mt-6 grid grid-cols-2 gap-3 rounded-xl bg-secondary/50 p-4 sm:grid-cols-4">
          {specRows.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-card text-primary shadow-xs">
                <row.icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">{row.label}</p>
                <p className="truncate text-sm font-bold">{row.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form className="mt-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mx-auto max-w-md space-y-3 text-center">
          <Label htmlFor="nationality-select" className="text-sm font-semibold text-foreground">
            Your passport nationality
          </Label>
          <CountrySearchSelect
            id="nationality-select"
            name="nationality"
            defaultValue={nationality}
            placeholder="Search for a country"
          />
          <Button type="submit" className="h-11 w-full text-sm">
            See price &amp; requirements
          </Button>
        </div>
      </form>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          {visa.eligibility_requirements ? (
            <section>
              <h2 className="font-heading text-xl font-bold">Eligibility requirements</h2>
              <p className="mt-2 leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {visa.eligibility_requirements}
              </p>
            </section>
          ) : null}

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

        <div className="space-y-4">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl leading-none">{countryFlag(visa.destination_country_code)}</span>
                <p className="font-heading text-base font-bold">{visa.name}</p>
              </div>

              <div className="mt-4 space-y-2.5 border-t border-border pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Government &amp; service fee</span>
                  <span className="font-semibold">{fmtMoney(price, visa.currency)}</span>
                </div>
                {Number(processingFee) > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing fee</span>
                    <span className="font-semibold">{fmtMoney(processingFee!, visa.currency)}</span>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">
                  {nationality ? "Total for you" : "Total from"}
                </span>
                <span className="font-heading text-3xl font-bold text-primary">
                  {fmtMoney(total, visa.currency)}
                </span>
              </div>

              <form action={startVisaApplication} className="mt-4 space-y-3">
                <input type="hidden" name="visaTypeId" value={visa.id} />
                {nationality ? <input type="hidden" name="nationality" value={nationality} /> : null}
                <SubmitButton size="lg" className="w-full gap-2" pendingText="Starting application…">
                  Apply Now <ArrowRight className="size-4" />
                </SubmitButton>
                <p className="text-center text-xs text-muted-foreground">
                  Sign in required — your progress is saved automatically.
                </p>
              </form>

              <Separator className="my-4" />

              <ul className="space-y-3">
                {SIDEBAR_ASSURANCES.map((item) => (
                  <li key={item.text} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                      <item.icon className="size-3.5" />
                    </span>
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>

            <a
              href={whatsappLink(`Hello STS, I have a question about the ${visa.name}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/50 p-4 transition-colors hover:bg-secondary"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-primary shadow-xs">
                <Headset className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Need help with this visa?</span>
                <span className="block text-xs text-muted-foreground">Chat with our visa desk on WhatsApp</span>
              </span>
              <MessageCircle className="size-4.5 shrink-0 text-primary" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
