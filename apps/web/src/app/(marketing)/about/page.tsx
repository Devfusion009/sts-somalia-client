import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  VerifiedIcon,
  PublicIcon,
  WorkspacePremiumIcon,
  ArrowForwardIcon,
  PhoneInTalkIcon,
  EmailIcon,
  MosqueIcon,
  HandshakeIcon,
  SupportAgentIcon,
  CheckCircleIcon,
  PlaceIcon,
} from "@/components/ui/mui-icons";
import { FadeIn, StaggerGroup, StaggerItem, CountUp } from "@/components/ui/aceternity/motion-primitives";
import { jsonLdScript } from "@/lib/json-ld";
import { CREDENTIALS, ISO_SCOPE, OFFICES, PRINCIPLES } from "@/components/marketing/about-data";

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
    images: [{ url: "/about/reception.webp", width: 1600, height: 1200 }],
  },
};

/* Accreditation wordmarks. Rendered as text, not logo artwork: we hold no
   licence to reproduce the IATA, ISO, SATTA or KATA marks, and a redrawn logo
   would be worse than an honest wordmark. */
const ACCREDITORS = [
  "IATA TIDS",
  "ISO 9001:2015",
  "SATTA Somalia",
  "KATA Kenya",
  "Somalia Ministry of Commerce",
  "Registrar of Companies, Kenya",
];

const STATS = [
  { value: 2022, suffix: "", label: "Incorporated in Nairobi under the Companies Act, 2015", icon: PublicIcon },
  { value: 7, suffix: "", label: "Licences, certifications and memberships held", icon: WorkspacePremiumIcon },
  { value: 8, suffix: "", label: "Service lines inside our audited ISO 9001 scope", icon: VerifiedIcon },
];

const EXPLORE = [
  {
    icon: MosqueIcon,
    title: "Travel with us",
    body: "Flights, hotels, visas and guided Umrah — planned by the desk that holds the licence.",
    cta: "Browse packages",
    href: "/umrah",
  },
  {
    icon: HandshakeIcon,
    title: "Partner with us",
    body: "Agencies, hotels and affiliates across the Horn of Africa work with STS on B2B terms.",
    cta: "See partner options",
    href: "/partners",
  },
  {
    icon: SupportAgentIcon,
    title: "Talk to our team",
    body: "A Mogadishu-based desk, reachable by phone and WhatsApp before and during your trip.",
    cta: "Contact us",
    href: "/#plan",
  },
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

      {/* ── Hero: statement left, photograph right ─────────────────────── */}
      <section className="bg-background pt-14 pb-16 sm:pt-20 lg:pt-24">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <FadeIn>
            <p className="text-sm font-semibold tracking-[0.14em] text-primary uppercase">About us</p>
            <h1 className="mt-4 font-heading text-4xl leading-[1.05] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              We plan.
              <br />
              You explore.
              <br />
              <span className="text-brand-accent">We care.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Scout Travel Solution Limited is a licensed Somali travel company. We arrange flights,
              hotels, visas and guided Umrah for families, businesses and pilgrims across the Horn of
              Africa — and we hold the paperwork to prove we&rsquo;re allowed to.
            </p>
          </FadeIn>

          <FadeIn delay={0.12}>
            <figure>
              <div className="relative aspect-4/3 overflow-hidden rounded-2xl ring-1 ring-border">
                <Image
                  src="/about/reception.webp"
                  alt="The STS reception in Mogadishu, with clocks showing Mogadishu, Nairobi and Dubai time"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="mt-2 text-right text-xs text-muted-foreground">
                Sultan Business Park, Mogadishu
              </figcaption>
            </figure>
          </FadeIn>
        </div>
      </section>

      {/* ── Accreditation strip ─────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/40 py-9">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground">
            Licensed, accredited and independently certified
          </p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2.5">
            {ACCREDITORS.map((name) => (
              <li
                key={name}
                className="rounded-full border border-border bg-card px-4 py-2 font-heading text-xs font-bold tracking-wide text-muted-foreground uppercase"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── At a glance: photo left, copy right ─────────────────────────── */}
      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <FadeIn direction="right">
            <div className="relative aspect-4/3 overflow-hidden rounded-2xl ring-1 ring-border">
              <Image
                src="/about/team-office.webp"
                alt="The STS team at work in the Mogadishu office"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              STS at a glance
            </h2>
            <div className="mt-5 space-y-4 leading-relaxed text-muted-foreground">
              <p>
                We were incorporated in Nairobi on 22 June 2022 under Kenya&rsquo;s Companies Act,
                2015, and we operate from Sultan Business Park in Mogadishu&rsquo;s Waaberi
                District, with a branch office in Nairobi&rsquo;s Eastleigh. That dual footprint is deliberate: it means a booking made in Somalia sits
                behind a registered company with a traceable legal identity.
              </p>
              <p>
                Somalia&rsquo;s Ministry of Commerce and Industry licenses us for Hajj and Umrah.
                IATA has assigned us a TIDS accreditation for ticketing. And our quality management
                system is independently certified to ISO 9001:2015 across every service we sell — not
                just the profitable ones.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <section className="bg-background pb-16 sm:pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <StaggerGroup className="grid gap-10 border-t border-border pt-12 sm:grid-cols-3">
            {STATS.map((stat) => (
              <StaggerItem key={stat.label}>
                <stat.icon sx={{ fontSize: 30 }} className="text-primary" />
                <p className="mt-4 font-heading text-4xl font-extrabold tabular-nums sm:text-5xl">
                  <CountUp value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{stat.label}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ── Principles band ─────────────────────────────────────────────── */}
      <section className="bg-secondary/50 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <FadeIn>
              <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                Somali-owned, and answerable
              </h2>
              <p className="mt-5 max-w-lg leading-relaxed text-muted-foreground">
                Travel is a trust business, and in this market trust is usually asked for rather than
                evidenced. We would rather show the documents. Everything below is on a certificate
                hanging in our office.
              </p>
              <Link
                href="#credentials"
                className="mt-7 inline-flex h-12 items-center gap-2 rounded-lg bg-sidebar px-7 font-heading text-sm font-bold text-sidebar-foreground transition-colors hover:bg-sidebar/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                See our credentials
                <ArrowForwardIcon sx={{ fontSize: 16 }} />
              </Link>
            </FadeIn>

            <FadeIn delay={0.1}>
              <div className="relative aspect-4/3 overflow-hidden rounded-2xl ring-1 ring-border">
                <Image
                  src="/about/training.webp"
                  alt="A training session run for staff and partners"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </FadeIn>
          </div>

          <StaggerGroup className="mt-14 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <StaggerItem key={p.title}>
                <h3 className="font-heading text-base font-bold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ── Credentials ─────────────────────────────────────────────────── */}
      <section id="credentials" className="scroll-mt-32 bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              The paperwork behind the promise
            </h2>
            <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-muted-foreground">
              Seven licences, certifications and memberships — issued by the Kenyan registrar,
              Somalia&rsquo;s Ministry of Commerce and Industry, IATA, an ISO certification body and
              the travel-agent associations of both countries.
            </p>
          </FadeIn>

          <FadeIn delay={0.1} className="mt-10">
            <div className="relative aspect-video overflow-hidden rounded-2xl ring-1 ring-border sm:aspect-[3/1.4]">
              <Image
                src="/about/credentials-wall.webp"
                alt="The framed licence and certification wall at the STS Mogadishu office"
                fill
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="object-cover"
              />
            </div>
          </FadeIn>

          <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CREDENTIALS.map((c) => (
              <StaggerItem key={c.key} className="grid">
                <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                  <VerifiedIcon sx={{ fontSize: 26 }} className="text-primary" />
                  <h3 className="mt-4 font-heading text-base font-bold">{c.label}</h3>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">{c.issuer}</p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{c.detail}</p>
                  {c.reference || c.validity ? (
                    <dl className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                      {c.reference ? (
                        <div className="flex gap-2">
                          <dt className="font-semibold">Ref</dt>
                          <dd className="font-mono">{c.reference}</dd>
                        </div>
                      ) : null}
                      {c.validity ? (
                        <div className="flex gap-2">
                          <dt className="font-semibold">Validity</dt>
                          <dd>{c.validity}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                </article>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ── ISO scope ───────────────────────────────────────────────────── */}
      <section className="bg-sidebar py-16 text-sidebar-foreground sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <FadeIn>
            <p className="text-sm font-semibold tracking-[0.14em] text-sidebar-primary uppercase">
              ISO 9001:2015 scope
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl">
              Eight service lines, independently audited
            </h2>
            <p className="mt-5 max-w-lg leading-relaxed text-sidebar-foreground/70">
              An ISO certificate is only as meaningful as the scope printed on it. Ours names every
              service we sell, so the same audited quality system covers a $45 hotel night and a
              fourteen-day Umrah group alike.
            </p>
            <ul className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {ISO_SCOPE.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-sidebar-foreground">
                  <CheckCircleIcon sx={{ fontSize: 18 }} className="mt-px shrink-0 text-sidebar-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="relative aspect-4/3 overflow-hidden rounded-2xl ring-1 ring-white/15">
              <Image
                src="/about/office-credentials.webp"
                alt="Framed certificates displayed in the STS office"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Pilgrimage ──────────────────────────────────────────────────── */}
      <section className="bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="max-w-2xl">
            <p className="text-sm font-semibold tracking-[0.14em] text-primary uppercase">On the ground</p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              We travel with our pilgrims
            </h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              Our Hajj and Umrah licence is not a line on a form. Every season our guides fly with
              the group, walk the ziyarah sites with them, and stay with elders and first-time
              pilgrims from the airport to the Haram and back.
            </p>
          </FadeIn>

          <StaggerGroup className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { src: "/about/umrah-group.webp", alt: "An STS pilgrim group gathered at a ziyarah site near Makkah", cap: "A season group at the ziyarah sites" },
              { src: "/about/ziyarah-guide.webp", alt: "An STS guide briefing women pilgrims at a ziyarah site", cap: "Guided ziyarah, in Somali" },
              { src: "/about/umrah-team.webp", alt: "STS team members outside the Prophet's Mosque in Madinah", cap: "Our team in Madinah" },
            ].map((p) => (
              <StaggerItem key={p.src} className="grid">
                <figure className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="relative aspect-4/3">
                    <Image src={p.src} alt={p.alt} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                  </div>
                  <figcaption className="p-4 text-sm font-medium text-muted-foreground">{p.cap}</figcaption>
                </figure>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      {/* ── Offices ─────────────────────────────────────────────────────── */}
      <section id="offices" className="scroll-mt-32 bg-muted/40 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="max-w-2xl">
            <p className="text-sm font-semibold tracking-[0.14em] text-primary uppercase">Our offices</p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Two branches, one company
            </h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              A head office in Mogadishu and a branch in Nairobi&rsquo;s Eastleigh — the two ends of
              the route most of our customers actually travel. Both are staffed by our own team, and
              a booking opened at one desk can be finished at the other.
            </p>
          </FadeIn>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {OFFICES.map((office, i) => (
              <FadeIn key={office.key} delay={i * 0.1}>
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow duration-300 hover:shadow-xl">
                  <div className="relative aspect-video">
                    <Image
                      src={office.image}
                      alt={office.alt}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover"
                    />
                    <span className="absolute top-4 left-4 rounded-full bg-brand-accent px-3 py-1.5 text-xs font-bold tracking-wide text-brand-accent-foreground uppercase shadow-lg">
                      {office.role}
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                    <h3 className="font-heading text-2xl font-bold">
                      {office.city}
                      <span className="ml-2 align-middle text-base font-semibold text-muted-foreground">
                        {office.country}
                      </span>
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-primary">{office.legalName}</p>

                    <address className="mt-5 space-y-3.5 not-italic">
                      <div className="flex gap-3">
                        <PlaceIcon sx={{ fontSize: 19 }} className="mt-px shrink-0 text-muted-foreground" />
                        <span className="text-sm leading-relaxed text-muted-foreground">
                          {office.lines.map((line) => (
                            <span key={line} className="block">
                              {line}
                            </span>
                          ))}
                          <span className="block">
                            {office.city}, {office.country}
                          </span>
                          {office.poBox ? <span className="mt-1 block">{office.poBox}</span> : null}
                        </span>
                      </div>

                      <div className="flex gap-3">
                        <PhoneInTalkIcon sx={{ fontSize: 19 }} className="mt-px shrink-0 text-muted-foreground" />
                        <a
                          href={office.phoneTel}
                          className="text-sm font-semibold transition-colors hover:text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {office.phoneDisplay}
                        </a>
                      </div>

                      <div className="flex gap-3">
                        <EmailIcon sx={{ fontSize: 19 }} className="mt-px shrink-0 text-muted-foreground" />
                        <a
                          href={`mailto:${office.email}`}
                          className="text-sm font-semibold transition-colors hover:text-primary focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          {office.email}
                        </a>
                      </div>
                    </address>

                    <div className="mt-auto pt-6">
                      <a
                        href={office.phoneTel}
                        className="inline-flex h-11 items-center gap-2 rounded-lg border-2 border-brand-accent px-5 font-heading text-sm font-bold text-brand-accent transition-colors hover:bg-brand-accent hover:text-brand-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                      >
                        <PhoneInTalkIcon sx={{ fontSize: 16 }} />
                        Call {office.city}
                      </a>
                    </div>
                  </div>
                </article>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Explore more ────────────────────────────────────────────────── */}
      <section className="bg-brand-accent py-16 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <h2 className="text-center font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              Explore more at STS
            </h2>
          </FadeIn>

          <StaggerGroup className="mt-10 grid gap-5 md:grid-cols-3">
            {EXPLORE.map((card) => (
              <StaggerItem key={card.title} className="grid">
                <article className="flex h-full flex-col rounded-2xl bg-white/95 p-7 text-foreground">
                  <card.icon sx={{ fontSize: 28 }} className="text-brand-accent" />
                  <h3 className="mt-4 font-heading text-lg font-bold">{card.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
                  <Link
                    href={card.href}
                    className="mt-6 inline-flex h-11 w-fit items-center gap-2 rounded-lg bg-sidebar px-5 font-heading text-sm font-bold text-sidebar-foreground transition-colors hover:bg-sidebar/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                  >
                    {card.cta}
                    <ArrowForwardIcon sx={{ fontSize: 15 }} />
                  </Link>
                </article>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>
    </div>
  );
}
