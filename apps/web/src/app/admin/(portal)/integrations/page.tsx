import type { Metadata } from "next";
import Link from "next/link";
import { getIntegrationsForAdmin, type IntegrationStatus } from "@/modules/admin/integrations/queries";
import type { ProviderCategory } from "@/lib/provider-catalog";
import { holidaysCountryCode } from "@/lib/provider-runtime/holidays";
import { getBankTransfer } from "@/lib/site-settings";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IntegrationCard } from "./integration-card";
import { BankTransferForm } from "./bank-transfer-form";

export const metadata: Metadata = { title: "Integrations" };

type TabKey = ProviderCategory | "built_in";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "payments", label: "Payments" },
  { key: "flights", label: "Flights" },
  { key: "hotels", label: "Hotels" },
  { key: "visa", label: "Visa" },
  { key: "visa_processing", label: "Visa processing" },
  { key: "built_in", label: "Built-in" },
];

function isTab(value: string | undefined): value is TabKey {
  return TABS.some((t) => t.key === value);
}

function liveCount(integrations: IntegrationStatus[]) {
  return integrations.filter((i) => i.hasCredentials && i.isActive).length;
}

function ProviderList({ integrations }: { integrations: IntegrationStatus[] }) {
  return (
    <div className="space-y-4">
      {integrations.map((status) => (
        // Keyed on the active flag so a switch flipped by another card (card
        // processors are mutually exclusive) remounts with the saved state.
        <IntegrationCard key={`${status.provider.key}-${status.isActive}`} status={status} />
      ))}
    </div>
  );
}

function PaymentsTab({ integrations, bank }: { integrations: IntegrationStatus[]; bank: Awaited<ReturnType<typeof getBankTransfer>> }) {
  const groups = ["Cards", "Mobile money"];
  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const inGroup = integrations.filter((i) => i.provider.group === group);
        return (
          <section key={group} className="space-y-3">
            <h2 className="font-heading text-base font-semibold">{group}</h2>
            <ProviderList integrations={inGroup} />
          </section>
        );
      })}
      <section className="space-y-3">
        <h2 className="font-heading text-base font-semibold">Bank transfer</h2>
        <BankTransferForm details={bank} />
      </section>
    </div>
  );
}

async function BuiltInTab() {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-base font-semibold">Public Holidays</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
            <span className="size-1.5 rounded-full bg-primary" />
            Live
          </span>
        </div>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">Civil source</dt>
            <dd className="font-medium">Nager.Date</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">Islamic source</dt>
            <dd className="font-medium">Aladhan</dd>
          </div>
          <div className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">Country</dt>
            <dd className="font-medium">{holidaysCountryCode()}</dd>
          </div>
        </dl>
        <Link href="/admin/calendar" className="inline-block text-sm font-medium text-primary hover:underline">
          Booking Calendar
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function AdminIntegrationsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: tabParam } = await searchParams;
  const tab: TabKey = isTab(tabParam) ? tabParam : "payments";
  const integrations = await getIntegrationsForAdmin();
  const bank = tab === "payments" ? await getBankTransfer() : null;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Integrations</h1>

      <nav aria-label="Integration categories" className="-mb-px flex flex-wrap gap-x-1 border-b">
        {TABS.map((t) => {
          const inTab = integrations.filter((i) => i.provider.category === t.key);
          const live = liveCount(inTab);
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/admin/integrations?tab=${t.key}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {inTab.length > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    live > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {live}/{inTab.length}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {tab === "payments" && bank ? (
        <PaymentsTab integrations={integrations.filter((i) => i.provider.category === "payments")} bank={bank} />
      ) : tab === "built_in" ? (
        <BuiltInTab />
      ) : (
        <ProviderList integrations={integrations.filter((i) => i.provider.category === tab)} />
      )}
    </div>
  );
}
