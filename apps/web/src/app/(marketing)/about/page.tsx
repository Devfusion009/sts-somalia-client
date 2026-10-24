import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  VerifiedIcon,
  ArrowForwardIcon,
  PhoneInTalkIcon,
  EmailIcon,
  MosqueIcon,
  HandshakeIcon,
  CheckCircleIcon,
  PlaceIcon,
  FlightIcon,
  HotelIcon,
  DescriptionIcon,
  CelebrationIcon,
  NearMeIcon,
} from "@/components/ui/mui-icons";
import type { SvgIconComponent } from "@/components/ui/mui-icons";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/ui/aceternity/motion-primitives";
import { SectionHeading } from "@/components/marketing/section-heading";
import { jsonLdScript } from "@/lib/json-ld";
import { CREDENTIALS, ISO_SCOPE, OFFICES, PRINCIPLES, SERVICES } from "@/components/marketing/about-data";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "About us",
  description:
    "Scout Travel Solution Limited — incorporated in Kenya in 2022, licensed by Somalia's Ministry of Commerce and Industry for Hajj and Umrah, IATA TIDS accredited and certified to ISO 9001:2015.",
  alternates: { canonical: "/about" },
  openGraph: {
    type: "website",
    url: "/about",
    title: "About Scout Travel Solution",
    description:
      "Licensed, accredited and certified — the credentials behind every STS booking.",
    images: [{ url: "/about/umrah-group-wide.webp", width: 1100, height: 825 }],
  },
};

const FACTS = [
  { value: "2022", label: "Incorporated in Nairobi" },
  { value: "2 offices", label: "Mogadishu and Nairobi" },
  { value: "IATA TIDS", label: "Accredited for ticketing" },
  { value: "ISO 9001:2015", label: "Certified quality system" },
];

const SERVICE_ICONS: Record<(typeof SERVICES)[number]["key"], SvgIconComponent> = {
  flights: FlightIcon,
  hotels: HotelIcon,
  visa: DescriptionIcon,
  umrah: MosqueIcon,
  events: CelebrationIcon,
  partners: HandshakeIcon,
};

/* Verifiable company particulars, in the order a due-diligence check reads them. */
const PROFILE: Array<[string, string]> = [
  ["Legal name", "Scout Travel Solution Limited"],
  ["Registration", "PVT-27USBRL7, private limited company, Kenya"],
  ["Incorporated", "22 June 2022"],
  ["Head office", "Sultan Business Park, Waaberi District, Mogadishu"],
  ["Branch office", "Yare Plaza, Eastleigh, Nairobi"],
  ["Hajj and Umrah licence", "Ministry of Commerce and Industry, Somalia, no. 030170"],
  ["Memberships", "SATTA (Somalia), KATA (Kenya)"],
];

const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  "@id": `${SITE_URL}/#organization`,
  name: "Scout Travel Solution Limited",
  alternateName: "STS Somalia",
  url: `${SITE_URL}/about`,
  logo: `${SITE_URL}/logo.png`,
  foundingDate: "2022-06-22",
  slogan: "Explore More, Travel Smart",
  telephone: "+252611444420",
  email: "info@scoutsts.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "First Floor 111, Sultan Business Park, Waaberi District",
    addressLocality: "Mogadishu",
    addressCountry: "SO",
  },
  /* The Nairobi branch, so search engines can surface the Kenyan office as a
     distinct place rather than folding it into the Mogadishu listing. */
  department: {
    "@type": "TravelAgency",
    "@id": `${SITE_URL}/#nairobi`,
    name: "Scout Travel Solution Ltd — Nairobi office",
    telephone: "+254711620420",
    email: "info@scoutsts.com",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Yare Plaza, 3rd Floor, Office 308, Mohamed Yusuf Haji Avenue, Eastleigh",
      postOfficeBoxNumber: "006101004",
      addressLocality: "Nairobi",
      addressCountry: "KE",
    },
  },
  hasCredential: CREDENTIALS.map((c) => ({
    "@type": "EducationalOccupationalCredential",
    name: c.label,
    recognizedBy: { "@type": "Organization", name: c.issuer },
  })),
};

export default function AboutPage() {
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(ORGANIZATION_JSON_LD) }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-background pt-14 pb-14 sm:pt-20 lg:pt-24">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8">
          <FadeIn>
            <h1 className="font-heading text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem]">
              Licensed travel, run from <span className="text-primary">Mogadishu and Nairobi.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Scout Travel Solution Limited arranges flights, hotels, visas and Hajj and Umrah for
              families, businesses and pilgrims across the Horn of Africa.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="#credentials"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-accent px-7 font-heading text-sm font-bold text-brand-accent-foreground shadow-sm transition-all duration-200 hover:bg-brand-accent/90 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                View our credentials
                <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </Link>
              <Link
                href="#offices"
                className="inline-flex h-12 items-center rounded-lg border border-border bg-card px-7 font-heading text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Find an office
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={0.12}>
            <div className="relative">
              <div className="relative aspect-4/3 overflow-hidden rounded-2xl ring-1 ring-border">
                <Image
                  src="/about/umrah-group-wide.webp"
                  alt="An STS pilgrim group gathered on ziyarah in Saudi Arabia"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
                <VerifiedIcon sx={{ fontSize: 26 }} className="text-primary" />
                <div>
                  <p className="font-heading text-sm leading-tight font-bold">ISO 9001:2015 certified</p>
                  <p className="text-xs text-muted-foreground">Licensed for Hajj and Umrah</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Key facts ────────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/40">
        <dl className="mx-auto grid max-w-7xl grid-cols-2 divide-border px-4 sm:px-6 lg:grid-cols-4 lg:divide-x lg:px-8">
          {FACTS.map((fact, i) => (
            <div
              key={fact.value}
              className={`flex flex-col px-2 py-7 lg:px-8 ${i % 2 === 1 ? "border-l border-border lg:border-l-0" : ""} ${i > 1 ? "border-t border-border lg:border-t-0" : ""}`}
            >
              <dt className="order-2 mt-1 text-sm text-muted-foreground">{fact.label}</dt>
              <dd className="order-1 font-heading text-2xl font-bold tracking-tight sm:text-3xl">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Company profile ──────────────────────────────────────────────── */}
      <section className="bg-background py-16 sm:py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <FadeIn>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              A travel company you can verify
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground">
              <p>
                STS was incorporated in Nairobi on 22 June 2022 and operates from Sultan Business Park
                in Mogadishu, with a branch in Eastleigh, Nairobi.
              </p>
              <p>
                Somalia&rsquo;s Ministry of Commerce and Industry licenses us for Hajj and Umrah. IATA
                has accredited our ticketing desk, and our quality management system is certified to
                ISO 9001:2015.
              </p>
            </div>
            <figure className="mt-8">
              <div className="relative aspect-video overflow-hidden rounded-2xl ring-1 ring-border">
                <Image
                  src="/about/sultan-business-park.webp"
                  alt="Sultan Business Park, home of the STS head office in Mogadishu"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover object-[50%_35%]"
                />
              </div>
              <figcaption className="mt-2 text-xs text-muted-foreground">
                Sultan Business Park, Waaberi District, Mogadishu
              </figcaption>
            </figure>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-muted/40 px-6 py-4">
                <h3 className="font-heading text-base font-bold">Company profile</h3>
              </div>
              <dl className="divide-y divide-border">
                {PROFILE.map(([term, detail]) => (
                  <div key={term} className="grid gap-1 px-6 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                    <dt className="text-sm text-muted-foreground">{term}</dt>
                    <dd className="text-sm font-medium">{detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── What we do ───────────────────────────────────────────────────── */}
      <section className="bg-muted/40 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <SectionHeading title="What we do" lead="Six ways to travel and trade with STS." />
          </FadeIn>
          <StaggerGroup className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => {
              const Icon = SERVICE_ICONS[service.key];
              return (
                <StaggerItem key={service.key} className="grid">
                  <Link
                    href={service.href}
                    className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-shadow duration-300 hover:border-primary/30 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon sx={{ fontSize: 24 }} />
                    </span>
                    <h3 className="mt-5 font-heading text-lg font-bold">{service.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{service.body}</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      Explore
                      <ArrowForwardIcon sx={{ fontSize: 15 }} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </section>

      {/* ── Principles ───────────────────────────────────────────────────── */}
      <section className="bg-background py-16 sm:py-20 lg:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:px-8">
          <FadeIn direction="right">
            <figure>
              <div className="relative aspect-4/3 overflow-hidden rounded-2xl ring-1 ring-border">
                <Image
                  src="/about/ziyarah-guide.webp"
                  alt="An STS guide briefing a group of women pilgrims at a ziyarah site"
                  fill
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-2 text-xs text-muted-foreground">An STS guide on ziyarah</figcaption>
            </figure>
          </FadeIn>

          <div>
            <FadeIn>
              <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                How we work
              </h2>
            </FadeIn>
            <StaggerGroup className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {PRINCIPLES.map((p, i) => (
                <StaggerItem key={p.title}>
                  <p className="font-heading text-sm font-bold text-primary tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-2 font-heading text-lg font-bold">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </div>
      </section>

      {/* ── Credentials register ─────────────────────────────────────────── */}
      <section id="credentials" className="scroll-mt-32 bg-muted/40 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <SectionHeading
              title="Licences and certifications"
              lead="Each entry is held on file at our Mogadishu office."
              align="left"
            />
          </FadeIn>

          <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_1.7fr] lg:gap-14">
            <FadeIn direction="right">
              <figure className="lg:sticky lg:top-28">
                <div className="relative aspect-4/3 overflow-hidden rounded-2xl ring-1 ring-border">
                  <Image
                    src="/about/office-credentials.webp"
                    alt="Framed STS certificates on a shelf in the Mogadishu office"
                    fill
                    sizes="(max-width: 1024px) 100vw, 38vw"
                    className="object-cover"
                  />
                </div>
                <figcaption className="mt-2 text-xs text-muted-foreground">Mogadishu office</figcaption>
              </figure>
            </FadeIn>

            <StaggerGroup className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <ul className="divide-y divide-border">
                {CREDENTIALS.map((c) => (
                  <li key={c.key}>
                    <StaggerItem className="grid gap-3 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-8 sm:px-6">
                      <div className="flex gap-4">
                        <VerifiedIcon sx={{ fontSize: 22 }} className="mt-0.5 shrink-0 text-primary" />
                        <div>
                          <h3 className="font-heading text-base font-bold">{c.label}</h3>
                          <p className="mt-0.5 text-sm text-muted-foreground">{c.issuer}</p>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.detail}</p>
                        </div>
                      </div>
                      {c.reference || c.validity ? (
                        <dl className="space-y-1 text-xs text-muted-foreground sm:text-right">
                          {c.reference ? (
                            <div>
                              <dt className="sr-only">Reference</dt>
                              <dd className="font-mono font-medium text-foreground">{c.reference}</dd>
                            </div>
                          ) : null}
                          {c.validity ? (
                            <div>
                              <dt className="sr-only">Validity</dt>
                              <dd>{c.validity}</dd>
                            </div>
                          ) : null}
                        </dl>
                      ) : null}
                    </StaggerItem>
                  </li>
                ))}
              </ul>
            </StaggerGroup>
          </div>
        </div>
      </section>

      {/* ── ISO scope ────────────────────────────────────────────────────── */}
      <section className="bg-sidebar py-16 text-sidebar-foreground sm:py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr] lg:gap-16 lg:px-8">
          <FadeIn>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">
              ISO 9001:2015 scope
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-sidebar-foreground/70">
              Eight service lines, certified by TQC Cert.
            </p>
          </FadeIn>
          <StaggerGroup className="grid gap-3 sm:grid-cols-2">
            {ISO_SCOPE.map((item) => (
              <StaggerItem key={item}>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-medium">
                  <CheckCircleIcon sx={{ fontSize: 18 }} className="shrink-0 text-sidebar-primary" />
                  {item}
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ── Pilgrimage ───────────────────────────────────────────────────── */}
      <section className="bg-background py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <SectionHeading
              title="We travel with our pilgrims"
              lead="Our guides fly with Umrah groups and stay with them through ziyarah."
              align="left"
            />
          </FadeIn>

          <StaggerGroup className="mt-12 grid gap-5 md:grid-cols-2 md:grid-rows-2">
            <StaggerItem className="md:row-span-2">
              <figure className="relative h-full min-h-72 overflow-hidden rounded-2xl ring-1 ring-border">
                <Image
                  src="/about/umrah-group-wide.webp"
                  alt="An STS pilgrim group gathered on ziyarah in Saudi Arabia"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
                <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-5 pt-12 text-sm font-medium text-white">
                  A season group on ziyarah
                </figcaption>
              </figure>
            </StaggerItem>
            {[
              { src: "/about/ziyarah-guide.webp", alt: "An STS guide briefing women pilgrims at a ziyarah site", cap: "Guided ziyarah, in Somali" },
              { src: "/about/umrah-team.webp", alt: "Four STS team members outside the Prophet's Mosque in Madinah", cap: "The STS team in Madinah" },
            ].map((p) => (
              <StaggerItem key={p.src}>
                <figure className="relative aspect-video overflow-hidden rounded-2xl ring-1 ring-border md:aspect-auto md:h-full">
                  <Image src={p.src} alt={p.alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-5 pt-12 text-sm font-medium text-white">
                    {p.cap}
                  </figcaption>
                </figure>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ── Offices ──────────────────────────────────────────────────────── */}
      <section id="offices" className="scroll-mt-32 bg-muted/40 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <SectionHeading title="Our offices" lead="Head office in Mogadishu, branch office in Nairobi." align="left" />
          </FadeIn>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {OFFICES.map((office, i) => (
              <FadeIn key={office.key} delay={i * 0.1}>
                <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-7 shadow-sm transition-shadow duration-300 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-heading text-2xl font-bold">{office.city}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{office.legalName}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      {office.role}
                    </span>
                  </div>

                  <address className="mt-7 space-y-4 not-italic">
                    <div className="flex gap-3">
                      <PlaceIcon sx={{ fontSize: 20 }} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <span className="text-sm leading-relaxed">
                        {office.lines.map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                        <span className="block">
                          {office.city}, {office.country}
                        </span>
                        {office.poBox ? <span className="block text-muted-foreground">{office.poBox}</span> : null}
                      </span>
                    </div>
                    <div className="flex gap-3">
                      <PhoneInTalkIcon sx={{ fontSize: 20 }} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <a
                        href={office.phoneTel}
                        className="text-sm font-semibold transition-colors hover:text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {office.phoneDisplay}
                      </a>
                    </div>
                    <div className="flex gap-3">
                      <EmailIcon sx={{ fontSize: 20 }} className="mt-0.5 shrink-0 text-muted-foreground" />
                      <a
                        href={`mailto:${office.email}`}
                        className="text-sm font-semibold transition-colors hover:text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        {office.email}
                      </a>
                    </div>
                  </address>

                  <div className="mt-auto flex flex-wrap gap-3 pt-8">
                    <a
                      href={office.phoneTel}
                      className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-accent px-5 font-heading text-sm font-bold text-brand-accent-foreground transition-colors hover:bg-brand-accent/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <PhoneInTalkIcon sx={{ fontSize: 16 }} />
                      Call {office.city}
                    </a>
                    <a
                      href={office.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-5 font-heading text-sm font-bold transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                    >
                      <NearMeIcon sx={{ fontSize: 16 }} />
                      Directions
                    </a>
                  </div>
                </article>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing call to action ───────────────────────────────────────── */}
      <section className="bg-sidebar py-16 text-sidebar-foreground sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <FadeIn>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">
              Plan your trip with a licensed desk
            </h2>
          </FadeIn>
          <FadeIn delay={0.1} className="flex flex-wrap gap-3">
            <Link
              href="/umrah"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand-accent px-7 font-heading text-sm font-bold text-brand-accent-foreground transition-colors hover:bg-brand-accent/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none"
            >
              Browse Umrah packages
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </Link>
            <Link
              href="/#plan"
              className="inline-flex h-12 items-center rounded-lg border border-white/25 px-7 font-heading text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar focus-visible:outline-none"
            >
              Contact our team
            </Link>
          </FadeIn>
        </div>
      </section>
    </div>
  );
}
