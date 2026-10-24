import type { Metadata } from "next";
import Link from "next/link";
import { getIntegrationsForAdmin, type IntegrationStatus } from "@/modules/admin/integrations/queries";
import type { ProviderCategory } from "@/lib/provider-catalog";
import { holidaysCountryCode } from "@/lib/provider-runtime/holidays";
import { getBankTransfer } from "@/lib/site-settings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
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
    <Card className="max-w-3xl">
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-semibold">Public holidays</h2>
            <Badge variant="success">Live</Badge>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/admin/calendar" />}>
            Booking calendar
          </Button>
        </div>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Civil source</dt>
            <dd className="mt-0.5 text-sm font-medium">Nager.Date</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Islamic source</dt>
            <dd className="mt-0.5 text-sm font-medium">Aladhan</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Country</dt>
            <dd className="mt-0.5 text-sm font-medium">{holidaysCountryCode()}</dd>
          </div>
        </dl>
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
      <PageHeader title="Integrations" />

      <nav
        aria-label="Integration categories"
        className="-mx-4 flex gap-x-1 overflow-x-auto border-b px-4 sm:mx-0 sm:flex-wrap sm:px-0"
      >
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
                "-mb-px flex shrink-0 items-center gap-2 rounded-t-md border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
              {inTab.length > 0 ? (
                <Badge variant={live > 0 ? "success" : "neutral"} className="tabular-nums">
                  {live}/{inTab.length}
                </Badge>
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
