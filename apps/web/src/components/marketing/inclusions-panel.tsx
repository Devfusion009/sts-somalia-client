import { Check, ShieldCheck } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Reveal } from "@/components/marketing/reveal";

/**
 * Spec-sheet style checklist panel. Absorbs the old ValueProps band —
 * security, human support, transparent pricing and local+international
 * coverage all live in this list now.
 */
const INCLUSIONS = [
  "Encrypted payments and verified partners on every booking",
  "Real human support from Mogadishu — before, during and after travel",
  "Transparent pricing: the price at search is the price you pay",
  "Domestic Somali routes and international journeys on one platform",
  "Instant digital confirmation and e-vouchers on WhatsApp and email",
  "Fare rules and cancellation windows explained before you pay",
  "Local payment options alongside cards — pay the way you already pay",
  "PDF receipts and invoices for every order",
  "Visa document checklists reviewed by our desk before submission",
  "Named-guest bookings for families and groups",
  "A booking history you can reopen, rebook and share anytime",
  "24/7 emergency line while you're travelling",
];

export function InclusionsPanel() {
  return (
    <section className="bg-muted/40 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="rounded-3xl border-2 border-primary/20 bg-card p-8 lg:p-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="grid size-13 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="size-6" aria-hidden />
              </span>
              <div>
                <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                  Every STS booking includes
                </h2>
                <p className="mt-1 text-muted-foreground">
                  Not add-ons. Not fine print. The baseline for every customer, on every service.
                </p>
              </div>
            </div>

            <Separator className="my-8" />

            <ul className="grid gap-x-10 gap-y-3.5 md:grid-cols-2">
              {INCLUSIONS.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-relaxed">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10">
                    <Check className="size-3 text-primary" strokeWidth={3} aria-hidden />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
