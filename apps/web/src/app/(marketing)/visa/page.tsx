import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Headset,
  MapPin,
  ShieldCheck,
  Sparkles,
  Timer,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getVisaTypes } from "@/modules/visa/queries";
import { countryFlag, countryName } from "@/lib/countries";
import { fmtMoney, processingText } from "@/modules/visa/components/visa-shared";
import { VisaRequirementBadge } from "@/modules/visa/components/visa-requirement-badge";
import { VisaHeroBanner, VisaProcess } from "@/components/marketing/visa-hero";
import { ReviewsRail } from "@/components/marketing/reviews-rail";
import { HomeFaq } from "@/components/marketing/home-faq";

export const metadata: Metadata = { title: "Visa Services" };

const TRUST_POINTS = [
  { icon: ShieldCheck, text: "Expert document review before submission" },
  { icon: Timer, text: "Real-time application tracking" },
  { icon: Sparkles, text: "Family & group applications in one flow" },
];

const WHY_US = [
  { icon: ShieldCheck, text: "Documents checked before they reach the consulate" },
  { icon: Timer, text: "Real-time tracking on every application" },
  { icon: Sparkles, text: "Family & group applications handled together" },
  { icon: Wallet, text: "Local payment methods — EVC Plus, bank, card" },
  { icon: Headset, text: "24/7 support from our Mogadishu-based team" },
];

/** Panel tint cycled across destination cards that have no photo below. */
const PANEL_TINTS = [
  "from-sky-500/20 to-sky-500/5",
  "from-emerald-500/20 to-emerald-500/5",
  "from-amber-500/20 to-amber-500/5",
  "from-violet-500/20 to-violet-500/5",
  "from-rose-500/20 to-rose-500/5",
  "from-teal-500/20 to-teal-500/5",
];

const DESTINATION_PHOTOS: Record<string, string> = {
  AE: "/marketing/dest-visa-ae.jpg",
  TR: "/marketing/dest-visa-tr.jpg",
  SA: "/marketing/dest-visa-sa.jpg",
  EG: "/marketing/dest-visa-eg.png",
  ET: "/marketing/dest-visa-et.jpg",
  KE: "/marketing/dest-visa-ke.png",
  MY: "/marketing/dest-visa-my.png",
};

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

          <form className="mt-8 flex max-w-lg items-center gap-1.5 rounded-full bg-white p-1.5 pl-5 shadow-2xl">
            <MapPin className="size-4 shrink-0 text-neutral-400" />
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
              aria-label="Search"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-gold text-neutral-900 transition-colors hover:bg-brand-gold/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowRight className="size-4.5" />
            </button>
          </form>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/15 backdrop-blur-sm">
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
            <div className="mt-9 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
              {featured.map((visa, i) => {
                const photo = DESTINATION_PHOTOS[visa.destination_country_code];
                return (
                <Link key={visa.id} href={`/visa/${visa.id}`} className="group block">
                  <div className="relative">
                    <div
                      className={`relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border border-border sm:h-32 ${photo ? "" : `bg-gradient-to-br ${PANEL_TINTS[i % PANEL_TINTS.length]}`}`}
                    >
                      {photo ? (
                        <Image
                          src={photo}
                          alt=""
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <span className="text-5xl leading-none drop-shadow-sm transition-transform duration-300 group-hover:scale-110 sm:text-6xl">
                          {countryFlag(visa.destination_country_code)}
                        </span>
                      )}
                      {photo ? <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" aria-hidden /> : null}
                      <Badge className="absolute top-2 left-2 border-transparent bg-brand-accent text-[10px] text-brand-accent-foreground">
                        Popular
                      </Badge>
                      {photo ? (
                        <span className="absolute right-2 bottom-2 text-2xl leading-none drop-shadow" aria-hidden>
                          {countryFlag(visa.destination_country_code)}
                        </span>
                      ) : null}
                    </div>
                    <div className="absolute inset-x-0 -bottom-6 flex justify-center">
                      <div className="flex min-w-[4.5rem] flex-col items-center justify-center rounded-full border-4 border-background bg-primary px-3 py-1.5 text-center whitespace-nowrap text-primary-foreground shadow-lg transition-transform duration-300 group-hover:scale-105">
                        <span className="text-[9px] leading-none font-semibold tracking-wide uppercase opacity-80">
                          From
                        </span>
                        <span className="font-heading text-sm leading-tight font-bold">
                          {fmtMoney(visa.price, visa.currency)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-9 text-center">
                    <h3 className="font-heading text-sm font-bold group-hover:text-primary sm:text-base">
                      {countryName(visa.destination_country_code)}
                    </h3>
                    <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Clock3 className="size-3" /> {processingText(visa)}
                    </p>
                  </div>
                </Link>
                );
              })}
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

      <section className="bg-background py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            Why book your visa with us
          </h2>
          <ul className="mx-auto mt-9 grid max-w-5xl grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-5">
            {WHY_US.map((point) => (
              <li key={point.text} className="flex flex-col items-center gap-3 text-center lg:items-center">
                <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                  <point.icon className="size-5" />
                </span>
                <p className="text-sm leading-snug text-muted-foreground">{point.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ReviewsRail />
      <HomeFaq />
    </div>
  );
}
