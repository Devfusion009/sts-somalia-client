import { ArrowRight, Check, Wallet, ShieldCheck } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { countryFlag } from "@/lib/countries";
import { startVisaApplication } from "@/modules/visa/actions";
import { fmtMoneyExact } from "@/modules/visa/components/visa-shared";
import { cn } from "@/lib/utils";

export type VisaFeeLine = { label: string; amount: number };

/** Apply form: starts the application, carrying the chosen passport into it. */
export function VisaApplyForm({
  visaId,
  nationality,
  className,
  size = "lg",
}: {
  visaId: string;
  nationality: string | null;
  className?: string;
  size?: "default" | "lg";
}) {
  return (
    <form action={startVisaApplication} className={className}>
      <input type="hidden" name="visaTypeId" value={visaId} />
      {nationality ? (
        <input type="hidden" name="nationality" value={nationality} />
      ) : null}
      <SubmitButton
        size={size}
        className="h-12 w-full gap-2 rounded-xl bg-brand-accent font-semibold text-brand-accent-foreground shadow-[0_5px_15px_-6px_rgba(249,115,22,0.5)] hover:bg-brand-accent/90"
        pendingText="Starting…"
      >
        Apply now <ArrowRight className="size-4" aria-hidden />
      </SubmitButton>
    </form>
  );
}

/**
 * Price card for one visa product: what is being bought, the fee lines and
 * their total per traveller, and the apply action. The total is the sum of
 * the lines shown, never a separate figure.
 */
export function VisaBookingSummary({
  id,
  visaId,
  visaName,
  category,
  destinationCode,
  currency,
  fees,
  nationality,
  assurances,
}: {
  id?: string;
  visaId: string;
  visaName: string;
  category: string;
  destinationCode: string;
  currency: string;
  fees: VisaFeeLine[];
  nationality: string | null;
  assurances: string[];
}) {
  const total = fees.reduce((sum, line) => sum + line.amount, 0);

  return (
    <section
      id={id}
      aria-labelledby="visa-price"
      className="scroll-mt-28 overflow-hidden rounded-3xl border border-border bg-card shadow-[0_15px_40px_-25px_rgba(7,60,52,0.35)]"
    >
      <div className="flex items-center gap-3.5 border-b border-white/10 bg-[#073c34] px-5 py-6 text-white sm:px-6">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-2xl leading-none ring-1 ring-white/15"
          aria-hidden
        >
          {countryFlag(destinationCode)}
        </span>
        <div className="min-w-0">
          <h2
            id="visa-price"
            className="font-heading text-lg leading-snug font-semibold"
          >
            {visaName}
          </h2>
          <div className="mt-1 text-xs text-[#badacd]">{category}</div>
        </div>
      </div>

      <div className="p-5 pt-4 sm:p-6 sm:pt-5">
        <dl className="space-y-2.5 text-sm">
          {fees.map((line) => (
            <div key={line.label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className="font-semibold tabular-nums">
                {fmtMoneyExact(line.amount, currency)}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-dashed border-border pt-5">
          <span className="text-sm font-semibold">
            {nationality ? "Total for you" : "Total from"}
            <span className="block text-xs font-normal text-muted-foreground">
              per traveller
            </span>
          </span>
          <span className="font-heading text-[1.85rem] font-semibold tracking-tight text-primary tabular-nums">
            {fmtMoneyExact(total, currency)}
          </span>
        </div>

        <VisaApplyForm
          visaId={visaId}
          nationality={nationality}
          className="mt-5"
        />

        <div className="mt-5 flex items-center gap-2 border-t border-border pt-5 text-[10px] font-semibold tracking-[0.12em] text-primary uppercase"><ShieldCheck className="size-3.5" aria-hidden /> Included with STS</div>
        <ul className="mt-3 space-y-2.5">
          {assurances.map((text) => (
            <li
              key={text}
              className="flex items-start gap-2 text-xs text-muted-foreground"
            >
              <Check
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              {text}
            </li>
          ))}
          <li className="flex items-start gap-2 text-xs text-muted-foreground">
            <Wallet
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden
            />
            Card, mobile money or bank transfer
          </li>
        </ul>
      </div>
    </section>
  );
}

/**
 * Phones: total and Apply pinned to the bottom of the screen while the price
 * card sits further down the page. Marked so the floating WhatsApp button
 * moves above it (globals.css).
 */
export function MobileBookingBar({
  visaId,
  nationality,
  currency,
  total,
  className,
}: {
  visaId: string;
  nationality: string | null;
  currency: string;
  total: number;
  className?: string;
}) {
  return (
    <div
      data-mobile-booking-bar
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.15)] backdrop-blur lg:hidden",
        className,
      )}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <p className="min-w-0">
          <span className="block text-xs text-muted-foreground">
            {nationality ? "Total for you" : "Total from"}
          </span>
          <span className="font-heading text-xl font-bold text-primary tabular-nums">
            {fmtMoneyExact(total, currency)}
          </span>
        </p>
        <VisaApplyForm
          visaId={visaId}
          nationality={nationality}
          size="default"
          className="w-36 shrink-0"
        />
      </div>
    </div>
  );
}
