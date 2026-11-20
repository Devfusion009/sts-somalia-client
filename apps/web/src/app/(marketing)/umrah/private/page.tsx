import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";

export const metadata: Metadata = {
  title: "Private Umrah",
  description: "Plan a private Umrah with the STS Somalia travel team on WhatsApp.",
};

const privateUmrahContactHref = "https://wa.me/252611444420?text=Hello%20STS%20Somalia.%20I%20would%20like%20to%20plan%20a%20private%20Umrah%20trip.%20Please%20contact%20me%20about%20a%20custom%20itinerary.";

export default function PrivateUmrahPage() {
  return <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <MarketingBreadcrumb className="mb-6" items={[{ label: "Umrah", href: "/umrah" }, { label: "Private Umrah" }]} />
    <section className="grid overflow-hidden rounded-3xl border border-border bg-card lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 lg:py-20">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">Private Umrah</span>
        <h1 className="mt-4 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Plan your private Umrah with STS</h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">Choose your dates, hotels and travel arrangements with our team. Contact us on WhatsApp for a custom itinerary and quote.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={privateUmrahContactHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><MessageCircle className="size-5" aria-hidden /> Contact STS on WhatsApp</a>
          <Link href="/umrah/group" className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-border px-5 font-semibold hover:bg-muted"><ArrowLeft className="size-4" aria-hidden /> View group packages</Link>
        </div>
      </div>
      <div className="relative min-h-72 lg:min-h-[32rem]"><Image src="/marketing/umrah-private-courtyard.webp" alt="Pilgrim in a mosque courtyard" fill className="object-cover" sizes="(max-width: 1024px) 100vw, 50vw" /></div>
    </section>
  </main>;
}
