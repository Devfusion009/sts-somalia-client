import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3, Search, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getVisaTypes } from "@/modules/visa/queries";
import { countryFlag, countryName } from "@/lib/countries";
import { fmtMoney, processingText } from "@/modules/visa/components/visa-shared";
import { VisaRequirementBadge } from "@/modules/visa/components/visa-requirement-badge";
import { VisaHeroBanner, VisaProcess } from "@/components/marketing/visa-hero";
import { HomeFaq } from "@/components/marketing/home-faq";

export const metadata: Metadata = { title: "Visa Services" };

const TRUST_POINTS = [
  { icon: ShieldCheck, text: "Expert document review before submission" },
  { icon: Timer, text: "Real-time application tracking" },
  { icon: Sparkles, text: "Family & group applications in one flow" },
];

export default async function VisaListPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  const visaTypes = await getVisaTypes({ country });
  const featured = !country ? visaTypes.filter((v) => v.is_featured) : [];

  return (
    <div>
      <VisaHeroBanner>
        <div className="max-w-2xl">
          <Badge className="border-white/25 bg-white/15 text-white backdrop-blur-sm">Visa services</Badge>
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
            Visas without the guesswork,{" "}
            <span className="text-brand-accent">wherever you&apos;re going</span>
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 drop-shadow">
            Our visa desk handles hundreds of applications a month. We know what each consulate
            actually wants — and we check it twice before it goes anywhere near them.
          </p>

          <form className="mt-8 flex max-w-lg items-center rounded-xl bg-white p-1.5 shadow-2xl">
            <Input
              name="country"
              autoComplete="off"
              placeholder="Where are you going? UAE, Türkiye, Kenya…"
              defaultValue={country}
              aria-label="Destination country"
              className="h-11 border-0 bg-transparent text-neutral-900 shadow-none placeholder:text-neutral-400 focus-visible:ring-0 dark:bg-transparent"
            />
            <button
              type="submit"
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-brand-accent px-6 font-heading text-sm font-bold text-brand-accent-foreground transition-colors hover:bg-brand-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Search className="size-4" /> Search
            </button>
          </form>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {TRUST_POINTS.map((point) => (
              <li key={point.text} className="flex items-center gap-2 text-sm font-medium text-white/85 drop-shadow">
                <point.icon className="size-4 text-teal-300" /> {point.text}
              </li>
            ))}
          </ul>
        </div>
      </VisaHeroBanner>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {featured.length > 0 ? (
          <section className="mb-10">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold">Popular destinations</h2>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((visa) => (
                <Link key={visa.id} href={`/visa/${visa.id}`} className="group">
                  <Card className="h-full overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
                    <CardContent className="flex h-full flex-col p-5">
                      <div className="flex items-start justify-between">
                        <span className="text-4xl leading-none">{countryFlag(visa.destination_country_code)}</span>
                        <Badge className="border-transparent bg-brand-accent/10 text-brand-accent">
                          Popular
                        </Badge>
                      </div>
                      <h3 className="mt-3 font-heading text-lg font-bold group-hover:text-primary">
                        {countryName(visa.destination_country_code)}
                      </h3>
                      <p className="text-sm text-muted-foreground">{visa.name}</p>
                      <div className="mt-4 flex flex-1 items-end justify-between">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock3 className="size-3.5" /> {processingText(visa)}
                        </span>
                        <span className="text-right">
                          <span className="block text-[10px] text-muted-foreground uppercase">From</span>
                          <span className="font-heading text-lg font-bold text-primary">
                            {fmtMoney(visa.price, visa.currency)}
                          </span>
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="font-heading text-xl font-bold">
            {country ? `Results for "${country}"` : "All visa services"}
          </h2>
          {visaTypes.length > 0 ? (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {visaTypes.map((visa) => (
                <Card key={visa.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <span className="text-3xl leading-none">{countryFlag(visa.destination_country_code)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          {countryName(visa.destination_country_code)}
                        </p>
                        <h3 className="font-heading text-base font-bold">{visa.name}</h3>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>Processing: {processingText(visa)}</span>
                          {visa.validity_days ? <span>Validity: {visa.validity_days} days</span> : null}
                          {visa.stay_days ? <span>Stay: {visa.stay_days} days</span> : null}
                          <span className="capitalize">
                            {visa.entry_type === "multiple" ? "Multiple entry" : "Single entry"}
                          </span>
                        </div>
                        <div className="mt-2">
                          <VisaRequirementBadge destinationCountryName={countryName(visa.destination_country_code)} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-muted-foreground uppercase">From</p>
                        <p className="font-heading text-lg font-bold text-primary">
                          {fmtMoney(visa.price, visa.currency)}
                        </p>
                        <Button size="sm" className="mt-2 gap-1" render={<Link href={`/visa/${visa.id}`} />}>
                          Apply <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="mt-4">
              <CardContent className="p-10 text-center text-muted-foreground">
                No visa services found{country ? ` for "${country}"` : ""}.{" "}
                <Link href="/visa" className="text-primary hover:underline">
                  View all visa services
                </Link>
                .
              </CardContent>
            </Card>
          )}
        </section>
      </div>

      <VisaProcess />
      <HomeFaq />
    </div>
  );
}
