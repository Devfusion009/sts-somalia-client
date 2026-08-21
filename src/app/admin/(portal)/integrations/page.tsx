import type { Metadata } from "next";
import Link from "next/link";
import { BedDouble, CalendarRange, CircleSlash, FileCheck2, Plane, Radio, Send, Settings2 } from "lucide-react";
import { getIntegrationsForAdmin, type IntegrationStatus } from "@/modules/admin/integrations/queries";
import type { ProviderCategory } from "@/lib/provider-catalog";
import { holidaysCountryCode } from "@/lib/provider-runtime/holidays";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IntegrationCard } from "./integration-card";

export const metadata: Metadata = { title: "Integrations" };

/**
 * One entry per category, so a section can render its own icon and copy
 * without the page special-casing categories inline.
 */
const CATEGORY_META: Record<ProviderCategory, { label: string; icon: typeof Plane; blurb: string }> = {
  flights: { label: "Flights", icon: Plane, blurb: "Live fares and airline availability in flight search." },
  hotels: { label: "Hotels", icon: BedDouble, blurb: "External room inventory blended into hotel search." },
  visa: { label: "Visa", icon: FileCheck2, blurb: "Passport-nationality visa requirement lookups." },
  visa_processing: { label: "Visa processing", icon: Send, blurb: "Partners who submit and track visa applications on STS's behalf." },
};

const CATEGORY_ORDER: ProviderCategory[] = ["flights", "hotels", "visa", "visa_processing"];

/**
 * The three states a provider can be in, as a count each. This is the thing an
 * admin actually opens this page to learn — previously it could only be worked
 * out by reading every card's toggle one at a time.
 */
function summarise(integrations: IntegrationStatus[]) {
  return {
    live: integrations.filter((i) => i.hasCredentials && i.isActive).length,
    idle: integrations.filter((i) => i.hasCredentials && !i.isActive).length,
    absent: integrations.filter((i) => !i.hasCredentials).length,
  };
}

function SummaryTile({
  icon: Icon,
  count,
  label,
  hint,
  tone,
}: {
  icon: typeof Radio;
  count: number;
  label: string;
  hint: string;
  tone: "live" | "idle" | "absent";
}) {
  const tones = {
    live: "border-primary/30 bg-primary/5 text-primary",
    idle: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-500",
    absent: "border-border bg-muted/40 text-muted-foreground",
  } as const;

  return (
    <Card className="shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${tones[tone]}`}>
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl leading-none font-semibold tabular-nums">{count}</p>
          <p className="mt-1 text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminIntegrationsPage() {
  const integrations = await getIntegrationsForAdmin();
  const summary = summarise(integrations);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-xl font-semibold">Integrations</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Connect third-party suppliers for flights, hotels, and visa requirements. Save an API key,
          test it, then activate — an active provider starts serving live results in search
          immediately.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile icon={Radio} count={summary.live} label="Live" hint="Serving results in search" tone="live" />
        <SummaryTile
          icon={Settings2}
          count={summary.idle}
          label="Configured"
          hint="Keys saved, not activated"
          tone="idle"
        />
        <SummaryTile
          icon={CircleSlash}
          count={summary.absent}
          label="Not connected"
          hint="No credentials saved yet"
          tone="absent"
        />
      </div>

      {CATEGORY_ORDER.map((category) => {
        const inCategory = integrations.filter((i) => i.provider.category === category);
        if (inCategory.length === 0) return null;
        const meta = CATEGORY_META[category];
        return (
          <section key={category} className="space-y-3">
            <div className="flex items-center gap-2.5 border-b pb-2.5">
              <meta.icon className="size-4 shrink-0 text-primary" />
              <h2 className="font-heading text-base font-semibold">{meta.label}</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {inCategory.length}
              </span>
              <p className="ml-2 hidden truncate text-sm text-muted-foreground sm:block">{meta.blurb}</p>
            </div>
            <div className="space-y-4">
              {inCategory.map((status) => (
                <IntegrationCard key={status.provider.key} status={status} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="space-y-3">
        <div className="flex items-center gap-2.5 border-b pb-2.5">
          <CalendarRange className="size-4 shrink-0 text-primary" />
          <h2 className="font-heading text-base font-semibold">Built-in</h2>
          <p className="ml-2 hidden truncate text-sm text-muted-foreground sm:block">
            Always on — nothing to configure here.
          </p>
        </div>
        <Card>
          <CardContent className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="min-w-0 space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">Public Holidays</h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
                    <span className="size-1.5 rounded-full bg-primary" />
                    Live
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Shows civil and Islamic holiday pills on the Booking Calendar. Free and keyless —
                  no API key to manage, unlike the providers above.
                </p>
              </div>

              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">Civil source</dt>
                  <dd className="truncate font-medium">Nager.Date</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="shrink-0 text-muted-foreground">Country</dt>
                  <dd className="font-medium">{holidaysCountryCode()}</dd>
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <dt className="shrink-0 text-muted-foreground">Islamic source</dt>
                  <dd className="min-w-0 font-medium">
                    Aladhan{" "}
                    <span className="font-normal text-muted-foreground">
                      — Eid al-Fitr, Eid al-Adha, Mawlid, Ashura, start of Ramadan. Dates are
                      astronomically calculated and may differ ±1 day from local moon sighting.
                    </span>
                  </dd>
                </div>
              </dl>

              <p className="text-xs text-muted-foreground">
                Configured via <code className="rounded bg-muted px-1 py-0.5">HOLIDAYS_API_URL</code>,{" "}
                <code className="rounded bg-muted px-1 py-0.5">HOLIDAYS_COUNTRY_CODE</code>, and{" "}
                <code className="rounded bg-muted px-1 py-0.5">ISLAMIC_HOLIDAYS_API_URL</code> in the
                environment — see .env.example.
              </p>
            </div>

            <Button size="sm" variant="outline" render={<Link href="/calendar" />}>
              View Booking Calendar
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
