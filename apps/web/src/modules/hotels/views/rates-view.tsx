import { format } from "date-fns";
import { CalendarDays, SlidersHorizontal } from "lucide-react";
import { getRatePreview, getRateRules } from "@/modules/hotels/rate-queries";
import { todayIso } from "@/modules/hotels/availability";
import { RateRulesEditor } from "@/modules/hotels/components/rate-rules-editor";
import { RatePlansEditor } from "@/modules/hotels/components/rate-plans-editor";
import { ExtrasEditor } from "@/modules/hotels/components/extras-editor";
import { getHotelExtras, getRatePlans } from "@/modules/hotels/rate-plan-queries";
import { Button } from "@/components/ui/button";
import { HotelMetric, HotelWorkspaceHeader, hotelStyles as styles } from "@/modules/hotels/components/hotel-workspace";
import { cn } from "@/lib/utils";

const PREVIEW_DAYS = 14;

export async function RatesView({ hotelId }: { hotelId: string }) {
  const today = todayIso();
  const [rules, preview, plans, extras] = await Promise.all([
    getRateRules(hotelId), getRatePreview(hotelId, today, PREVIEW_DAYS), getRatePlans(hotelId), getHotelExtras(hotelId),
  ]);
  const currency = preview[0]?.currency ?? "USD";
  const nights = preview[0]?.nights.map((n) => n.night) ?? [];
  const currencies = [...new Set(preview.map((room) => room.currency))];
  const prices = preview.flatMap((room) => room.nights.map((night) => night.rate));
  const lowest = prices.length && currencies.length === 1 ? Math.min(...prices) : null;
  const highest = prices.length && currencies.length === 1 ? Math.max(...prices) : null;
  const rateRange = lowest === null || highest === null ? "—" : lowest === highest ? lowest.toLocaleString("en-US") : `${lowest.toLocaleString("en-US")}–${highest.toLocaleString("en-US")}`;

  return (
    <div className={styles.workspace}>
      <HotelWorkspaceHeader title="Rates & pricing" eyebrow="Revenue management"
        meta={<span className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">{currencies.length > 1 ? "Multiple currencies" : currency}</span>}
        actions={<Button variant="outline" render={<a href="#rate-rules" />}><SlidersHorizontal aria-hidden="true" />Rate rules</Button>}
      />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <HotelMetric label="Nightly price range" value={rateRange} detail={`${currencies.length === 1 ? currency : "Multiple currencies"} · Next 14 nights`} featured />
        <HotelMetric label="Room types" value={preview.length} />
        <HotelMetric label="Active rate plans" value={plans.filter((plan) => plan.isActive).length} />
        <HotelMetric label="Pricing rules" value={rules.length} />
      </dl>

      <section className={styles.surface} aria-labelledby="nightly-rates-heading">
        <div className={styles.sectionHeading}>
          <h2 id="nightly-rates-heading">Nightly rates</h2>
          <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums"><CalendarDays className="size-3.5" aria-hidden="true" />
            {nights.length ? `${format(new Date(`${nights[0]}T00:00:00`), "d MMM")} – ${format(new Date(`${nights[nights.length - 1]}T00:00:00`), "d MMM yyyy")}` : "Next 14 nights"}
          </span>
        </div>
        {preview.length ? <div className="overflow-x-auto">
          <table className={cn(styles.rateTable, "w-full border-separate border-spacing-0 text-sm")}>
            <caption className="sr-only">Effective nightly rates by room type. Currency is listed with each room.</caption>
            <thead>
              <tr className="bg-secondary/30 text-muted-foreground">
                <th scope="col" className="sticky left-0 z-10 min-w-44 bg-card px-5 py-4 text-left text-xs font-medium">Room type</th>
                {nights.map((night) => {
                  const date = new Date(`${night}T00:00:00`);
                  const weekend = date.getDay() === 5 || date.getDay() === 6;
                  return <th key={night} scope="col" className={cn("min-w-14 px-1.5 py-3 text-center font-normal", weekend && "bg-secondary/60")}>
                    <span className="block text-[10px]">{format(date, "EEE")}</span>
                    <span className={cn("mx-auto mt-1 grid size-7 place-items-center rounded-lg text-sm font-semibold tabular-nums", night === today && "bg-primary text-primary-foreground")}>{format(date, "d")}</span>
                  </th>;
                })}
              </tr>
            </thead>
            <tbody>
              {preview.map((room) => <tr key={room.roomId}>
                <th scope="row" className="sticky left-0 z-10 border-r border-b border-border bg-card px-5 py-5 text-left"><span className="block text-xs font-semibold whitespace-nowrap">{room.roomName}</span><span className="mt-1 block text-[10px] font-normal text-muted-foreground tabular-nums">{room.currency} · Base {room.basePrice.toLocaleString("en-US")}</span></th>
                {room.nights.map((night) => <td key={night.night} title={`${room.currency} ${night.rate.toLocaleString("en-US")} · ${night.ruleName ?? (night.source === "override" ? "Date override" : "Base rate")}`}
                  className={cn("px-1 py-3 text-center text-xs font-medium tabular-nums", night.source === "rule" && "bg-brand-gold/10", night.source === "override" && "bg-primary/5")}>
                  <span className={cn("inline-flex min-h-8 min-w-10 items-center justify-center rounded-md px-1", night.source === "rule" && "bg-brand-gold/15 text-foreground", night.source === "override" && "bg-primary/10 text-primary")}>{Math.round(night.rate).toLocaleString("en-US")}</span>
                  <span className={cn("mx-auto mt-1 block h-0.5 w-4 rounded-full", night.source === "rule" ? "bg-brand-gold" : night.source === "override" ? "bg-primary" : "bg-border")} />
                </td>)}
              </tr>)}
            </tbody>
          </table>
        </div> : <div className="py-12 text-center text-sm text-muted-foreground">No room types</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
          <span>{preview.length} room types · {nights.length} nights</span>
          <div className="flex items-center gap-4"><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-muted-foreground/40" />Base rate</span><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-brand-gold" />Rule</span><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-primary" />Override</span></div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section id="rate-plans" className={cn(styles.surface, "scroll-mt-6")} aria-labelledby="rate-plans-heading">
          <div className={styles.sectionHeading}><h2 id="rate-plans-heading">Rate plans</h2><span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground tabular-nums">{plans.length}</span></div>
          <div className="p-5"><RatePlansEditor hotelId={hotelId} plans={plans} currency={currency} /></div>
        </section>
        <section className={styles.surface} aria-labelledby="extras-heading">
          <div className={styles.sectionHeading}><h2 id="extras-heading">Extras & services</h2><span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground tabular-nums">{extras.length}</span></div>
          <div className="p-5"><ExtrasEditor hotelId={hotelId} extras={extras} currency={currency} /></div>
        </section>
      </div>
      <section id="rate-rules" className={cn(styles.surface, "scroll-mt-6")} aria-labelledby="rate-rules-heading">
        <div className={styles.sectionHeading}><h2 id="rate-rules-heading">Rate rules</h2><span className="rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground tabular-nums">{rules.length}</span></div>
        <div className="p-5"><RateRulesEditor hotelId={hotelId} rules={rules} roomTypes={preview.map((room) => ({ id: room.roomId, name: room.roomName }))} today={today} /></div>
      </section>
    </div>
  );
}
