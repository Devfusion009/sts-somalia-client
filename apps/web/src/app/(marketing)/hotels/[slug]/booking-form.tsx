import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Room or rate CTA into the review-and-book page. */
export function BookingForm({
  href,
  available = true,
}: {
  href: string;
  /** False when not enough rooms are left for the dates: the booking goes to STS as a request. */
  available?: boolean;
}) {
  return (
    <Link href={href} className={buttonVariants({ size: "lg", className: "shrink-0 gap-1.5" })}>
      {available ? "Book now" : "Request booking"} <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}
