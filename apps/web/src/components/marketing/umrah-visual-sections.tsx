import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, BusFront, Check } from "lucide-react";

const BOOKING_STEPS = [
  "Choose your package",
  "Add pilgrim details",
  "Deposit or full payment",
  "Visa & travel confirmation",
  "Stay in touch",
];

export function UmrahBookingJourney() {
  return (
    <section aria-labelledby="umrah-journey" className="border-t border-border bg-white py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="umrah-journey" className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            Booking your Umrah
          </h2>
          <Link href="#umrah-flows" className="inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
            Choose your package <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {BOOKING_STEPS.map((title, index) => (
            <li key={title} className="flex items-start gap-3 border-t border-border pt-4">
              <span className="text-sm font-medium text-primary" aria-hidden="true">0{index + 1}</span>
              <span className="text-sm leading-relaxed font-medium">{title}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const SERVICE_GALLERIES = [
  {
    id: "umrah-transportation",
    title: "Transportation",
    icon: BusFront,
    features: ["Airport ↔ hotel", "Makkah ↔ Madinah", "Ziyarah trips", "Air-conditioned"],
    photos: [
      { image: "modern-coach-v1.webp", title: "Modern coaches", detail: "Air-conditioned group transport", alt: "Green and black touring coach parked outside a transport depot", position: "center 75%" },
      { image: "intercity-coach-v1.webp", title: "Makkah ↔ Madinah", detail: "Intercity coach transfers", alt: "Bronze intercity coach with luggage compartments and tinted windows", position: "center" },
      { image: "airport-pickup-v1.webp", title: "Airport pick-up", detail: "Airport-to-hotel transfers", alt: "Pilgrims with luggage boarding a white coach at the airport", position: "center" },
      { image: "private-car-v1.webp", title: "Private car", detail: "On request · additional charge", alt: "White Toyota sedan parked beside a sandstone-colored wall", position: "center 65%" },
    ],
  },
  {
    id: "umrah-hotels",
    title: "Hotels",
    icon: Building2,
    features: ["Makkah & Madinah", "Twin, triple & quad rooms", "Air-conditioned", "24-hour reception"],
    photos: [
      { image: "hotel-view-v1.webp", title: "Rooms with a view", detail: "Selected rooms · subject to availability", alt: "Three-bed room with turquoise furnishings and a window facing the Makkah clock tower", position: "center" },
      { image: "triple-room-v1.webp", title: "Triple rooms", detail: "Three single beds", alt: "Three single beds with turquoise runners beside a curtained window", position: "center" },
      { image: "quad-room-v1.webp", title: "Quadruple rooms", detail: "Shared accommodation for four", alt: "Hotel room with single beds, bedside lamps and a city-facing window", position: "center" },
      { image: "hotel-lobby-v1.webp", title: "Hotel reception", detail: "Reception & lounge", alt: "Hotel lobby with marble floors, upholstered sofas and ceiling lights", position: "center" },
    ],
  },
];

export function UmrahServiceGallery() {
  return (
    <section aria-label="Umrah hotels and transportation" className="bg-[#f8f7f2] py-12 sm:py-16">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:gap-8 sm:px-6 lg:px-8">
        {SERVICE_GALLERIES.map((gallery) => (
          <section key={gallery.id} aria-labelledby={gallery.id} className="rounded-2xl border border-border bg-white p-4 sm:rounded-3xl sm:p-7 lg:p-8">
            <div className="flex items-center gap-3 text-[#153f32]">
              <gallery.icon className="size-6 shrink-0 text-primary" aria-hidden="true" />
              <h2 id={gallery.id} className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{gallery.title}</h2>
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {gallery.features.map((feature) => (
                <li key={feature} className="flex items-center gap-1.5">
                  <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />{feature}
                </li>
              ))}
            </ul>
            <div className="mt-6 grid gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
              {gallery.photos.map((photo) => (
                <figure key={photo.image} className="min-w-0">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-secondary">
                    <Image
                      src={`/marketing/umrah-services/${photo.image}`}
                      alt={photo.alt}
                      fill
                      sizes="(min-width: 1280px) 268px, (min-width: 1024px) 23vw, (min-width: 640px) 44vw, 90vw"
                      className="object-cover"
                      style={{ objectPosition: photo.position }}
                    />
                  </div>
                  <figcaption className="pt-4">
                    <h3 className="font-heading text-base leading-snug font-semibold text-[#153f32]">{photo.title}</h3>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{photo.detail}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
