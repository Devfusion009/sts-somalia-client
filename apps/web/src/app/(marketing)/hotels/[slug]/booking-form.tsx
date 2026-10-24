import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Room-card CTA. A full review-and-book page (./book) replaced the old
 * cramped dialog — dates, guest count, special requests and price all need
 * room to breathe, and a dialog can't hold that without scrolling inside a
 * scrollbar inside a scrollbar.
 */
export function BookingForm({
  hotelSlug,
  room,
  bookingMode = "manual",
  defaults,
}: {
  hotelSlug: string;
  room: { id: string; base_price: number };
  /** 'manual': submit a request STS confirms by hand — no payment until confirmed. 'instant': pay at checkout. */
  bookingMode?: "manual" | "instant";
  defaults?: { checkIn?: string; checkOut?: string; guests?: string };
}) {
  const params = new URLSearchParams({ roomId: room.id });
  if (defaults?.checkIn) params.set("checkIn", defaults.checkIn);
  if (defaults?.checkOut) params.set("checkOut", defaults.checkOut);
  if (defaults?.guests) params.set("guests", defaults.guests);

  return (
    <Link href={`/hotels/${hotelSlug}/book?${params.toString()}`} className={buttonVariants({ size: "lg", className: "gap-1.5" })}>
      {bookingMode === "manual" ? "Request booking" : "Book"} <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}
