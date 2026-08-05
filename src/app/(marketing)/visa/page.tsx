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
      {/* Hero */}
      <section className="bg-gradient-to-br from-sidebar via-sidebar to-primary/40 text-sidebar-foreground">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-2xl">
            <Badge className="border-transparent bg-primary/20 text-primary-foreground">
              Visa Services
            </Badge>
            <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Visas made simple, <span className="text-brand-accent">wherever you&apos;re going</span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/80">
              Apply online in minutes — STS handles the paperwork, follows up with the immigration
              authorities, and keeps you updated at every step.
            </p>
            <form className="mt-7 flex max-w-lg gap-2 rounded-2xl bg-background/95 p-2 shadow-lg">
              <Input
                name="country"
                autoComplete="off"
                placeholder="Where do you want to go? (e.g. UAE, Turkey)"
                defaultValue={country}
                className="border-0 bg-transparent text-foreground shadow-none focus-visible:ring-0"
              />
              <Button type="submit" size="lg" className="shrink-0 gap-1.5">
                <Search className="size-4" /> Search
              </Button>
            </form>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
              {TRUST_POINTS.map((point) => (
                <li key={point.text} className="flex items-center gap-2 text-sm text-sidebar-foreground/80">
                  <point.icon className="size-4 text-primary" /> {point.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

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
    </div>
  );
}
