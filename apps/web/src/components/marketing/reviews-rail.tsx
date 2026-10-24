"use client";

import Image from "next/image";
import Rating from "@mui/material/Rating";
import Avatar from "@mui/material/Avatar";

import { CarouselRail } from "@/components/ui/aceternity/carousel-rail";
import { FadeIn } from "@/components/ui/aceternity/motion-primitives";
import { SectionHeading } from "@/components/marketing/section-heading";

/**
 * PLACEHOLDER reviews — plausible but fictional, with initials-only avatars.
 * Replace with real, permissioned customer reviews before launch; never pair
 * an invented quote with a stock photo of a real person.
 */
const REVIEWS = [
  {
    name: "Amina Hassan",
    city: "Mogadishu",
    rating: 5,
    image: "/marketing/dubai.webp",
    text: "I booked flights and a hotel in Dubai for my whole family from my phone. When our return flight moved, STS called me before the airline's SMS even arrived.",
  },
  {
    name: "Yusuf Abdi",
    city: "Hargeisa",
    rating: 5,
    image: "/marketing/dest-jeddah.webp",
    text: "The visa desk checked my documents twice and caught a bank statement that would have been rejected. My UAE visa came back in four days.",
  },
  {
    name: "Fartun Mohamed",
    city: "Mogadishu",
    rating: 5,
    image: "/marketing/madinah.webp",
    text: "Our Umrah group had elders travelling for the first time. The guide, the hotels near the Haram, the transport — everything was exactly as promised.",
  },
  {
    name: "Khadar Warsame",
    city: "Bosaso",
    rating: 5,
    image: "/marketing/kenya.webp",
    text: "Business trip to Nairobi arranged in one phone call. Invoice, e-ticket and hotel voucher were in my inbox before I hung up.",
  },
];

export function ReviewsRail() {
  return (
    <section id="reviews" className="scroll-mt-32 bg-gradient-to-b from-secondary/50 to-background py-16 sm:py-20 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
        <FadeIn direction="right" className="lg:col-span-4">
          <SectionHeading
            align="left"
            title="What travellers say"
            lead="Word of mouth built this agency long before the website did."
          />
        </FadeIn>

        <FadeIn delay={0.12} className="min-w-0 lg:col-span-8">
          <CarouselRail ariaLabel="Traveller reviews" itemClassName="w-[280px] sm:w-[320px]">
            {REVIEWS.map((review) => (
              <figure
                key={review.name}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="relative h-36 w-full">
                  <Image src={review.image} alt="" fill sizes="320px" className="object-cover" />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <figcaption className="flex items-center gap-3">
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: "var(--mui-palette-primary-main)",
                        color: "var(--mui-palette-primary-contrastText)",
                        fontFamily: "var(--font-heading)",
                        fontWeight: 700,
                        fontSize: 15,
                      }}
                    >
                      {review.name.charAt(0)}
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-heading text-sm font-bold">{review.name}</p>
                      <p className="text-xs text-muted-foreground">{review.city}</p>
                    </div>
                  </figcaption>
                  <div className="mt-3 flex items-center gap-2">
                    <Rating
                      value={review.rating}
                      readOnly
                      size="small"
                      sx={{ "& .MuiRating-iconFilled": { color: "var(--brand-gold)" } }}
                    />
                    <span className="text-xs font-semibold text-muted-foreground">{review.rating}.0</span>
                  </div>
                  <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    &ldquo;{review.text}&rdquo;
                  </blockquote>
                </div>
              </figure>
            ))}
          </CarouselRail>
        </FadeIn>
      </div>
    </section>
  );
}
