import { OperationsMetrics } from "../operations-ui";
import styles from "../operations.module.css";
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
    <div className={styles.providerGrid}>
      {integrations.map((status) => (
        // Keyed on the active flag so a switch flipped by another card (card
        // processors are mutually exclusive) remounts with the saved state.
        <IntegrationCard key={`${status.provider.key}-${status.isActive}`} status={status} />
      ))}
    </div>
  );
}

function PaymentsTab({ integrations, bank }: { integrations: IntegrationStatus[]; bank: Awaited<ReturnType<typeof getBankTransfer>> }) {
  const groups = [...new Set(integrations.map((i) => i.provider.group ?? ""))].filter(Boolean);
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
    <div className={`${styles.page} space-y-6`}>
      <PageHeader title="Integrations" />

      <OperationsMetrics items={[
        { label: "Live providers", value: liveCount(integrations), tone: "primary" },
        { label: "Saved · inactive", value: integrations.filter((i) => i.hasCredentials && !i.isActive).length, tone: "warning" },
        { label: "Not connected", value: integrations.filter((i) => !i.hasCredentials).length },
      ]} />
      <nav
        aria-label="Integration categories"
        className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/40 p-1.5"
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
                "flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "border-border bg-card text-foreground shadow-xs" : "border-transparent text-muted-foreground hover:text-foreground"
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
