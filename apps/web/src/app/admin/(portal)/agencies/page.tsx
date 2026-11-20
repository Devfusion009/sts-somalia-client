import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Building2, ChevronRight, Search, Users } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAllAgenciesForAdmin, getPendingMarkupRequestsForAdmin } from "@/modules/agencies/queries";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { StatStrip, StatStripItem } from "@/components/dashboard/filter-chips";
import { MarkupApprovalQueue, type MarkupQueueItem } from "./markup-approval-queue";

export const metadata: Metadata = { title: "Travel agencies" };

export default async function AdminAgenciesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requirePlatformAdmin();
  const filters = await searchParams;
  const [agencies, { requests: pendingRequests, currentRules }] = await Promise.all([
    getAllAgenciesForAdmin(),
    getPendingMarkupRequestsForAdmin(),
  ]);
  const pendingByAgency = new Map<string, number>();
  for (const request of pendingRequests) {
    pendingByAgency.set(request.agency_id, (pendingByAgency.get(request.agency_id) ?? 0) + 1);
  }
  const searchValue = typeof filters.q === "string" ? filters.q : "";
  const query = searchValue.trim().toLocaleLowerCase();
  const status = filters.status === "active" || filters.status === "suspended" ? filters.status : "all";
  const visibleAgencies = agencies.filter((agency) =>
    (status === "all" || agency.status === status) &&
    (!query || [agency.name, agency.agent_code, agency.contact_email].some((value) => value?.toLocaleLowerCase().includes(query)))
  );
  const activeCount = agencies.filter((agency) => agency.status === "active").length;
  const memberCount = agencies.reduce((total, agency) => total + (agency.agency_members?.[0]?.count ?? 0), 0);
  const creditExposure = agencies.reduce((total, agency) => total + Math.max(0, -Number(agency.credit_balance)), 0);
  // Flattened to plain data for the client-side queue (Maps and joined rows
  // don't cross the server/client boundary).
  const queueItems: MarkupQueueItem[] = pendingRequests.map((request) => {
    const agency = request.agency as { id: string; name: string } | null;
    const requester = request.requester as { full_name: string | null; email: string } | null;
    return {
      id: request.id,
      agencyId: request.agency_id,
      agencyName: agency?.name ?? "Agency",
      itemType: request.item_type,
      action: request.action,
      markupType: request.markup_type,
      value: request.value,
      requestedAtLabel: format(new Date(request.requested_at), "dd MMM yyyy, hh:mm a"),
      requester: requester?.full_name ?? requester?.email ?? "—",
      current: currentRules.get(`${request.agency_id}:${request.item_type ?? "all"}`) ?? null,
      fallback: currentRules.get(`${request.agency_id}:all`) ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="inline-flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-5" /></span>Travel agencies</span>}
        status={
          <Badge variant="neutral" className="tabular-nums">
            {agencies.length}
          </Badge>
        }
      />

      <StatStrip>
        <StatStripItem label="Total agencies" value={agencies.length} />
        <StatStripItem label="Active" value={activeCount} tone="primary" />
        <StatStripItem label="Team members" value={memberCount} />
        <StatStripItem label="Credit used" value={money(creditExposure, "USD")} />
      </StatStrip>

      {queueItems.length > 0 ? <MarkupApprovalQueue items={queueItems} /> : null}

      <Card className="overflow-hidden py-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4 sm:p-5">
          <div>
            <h2 className="font-heading text-base font-semibold">Agency directory</h2>
            <p className="text-xs text-muted-foreground">{visibleAgencies.length} of {agencies.length} agencies</p>
          </div>
          <form method="get" className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="relative min-w-48 flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Search agencies</span>
              <input name="q" defaultValue={searchValue} placeholder="Search name, code or email" className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </label>
            <label className="sr-only" htmlFor="agency-status">Agency status</label>
            <select id="agency-status" name="status" defaultValue={status} className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="all">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option>
            </select>
            <Button type="submit" variant="outline">Apply</Button>
          </form>
        </div>
        {agencies.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>No agencies</EmptyTitle>
          </Empty>
        ) : visibleAgencies.length === 0 ? (
          <Empty><EmptyMedia variant="icon"><Search /></EmptyMedia><EmptyTitle>No matching agencies</EmptyTitle></Empty>
        ) : (
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Agency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead numeric>Commission</TableHead>
                <TableHead numeric>Wallet / credit</TableHead>
                <TableHead numeric>Members</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleAgencies.map((agency) => {
                const pending = pendingByAgency.get(agency.id) ?? 0;
                const balance = Number(agency.credit_balance);
                return (
                  <TableRow key={agency.id} className="h-20 hover:bg-primary/[0.035]">
                    <TableCell className="max-w-[24rem]">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="size-5" /></span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Link href={`/admin/agencies/${agency.id}`} className="rounded-sm font-semibold outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50">
                              {agency.name}
                            </Link>
                            {pending > 0 ? (
                              <Badge variant="warning" className="tabular-nums" render={<Link href={`/admin/agencies/${agency.id}#markups`} />}>
                                {pending} markup {pending === 1 ? "request" : "requests"}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            <span className="font-mono text-foreground">{agency.agent_code}</span> · {agency.contact_email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(agency.status)} className="capitalize">
                        {agency.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{agency.agency_tiers?.name ?? "Unassigned"}</TableCell>
                    <TableCell numeric className="tabular-nums">
                      {agency.commission_rate}%
                    </TableCell>
                    <TableCell numeric className="tabular-nums">
                      <div className={cn("font-semibold", balance < 0 && "text-destructive")}>{money(balance, "USD")}</div>
                      <div className="text-xs text-muted-foreground">Limit {money(agency.credit_limit, "USD")}</div>
                    </TableCell>
                    <TableCell numeric className="tabular-nums">
                      <span className="inline-flex items-center gap-1.5"><Users className="size-3.5 text-muted-foreground" />{agency.agency_members?.[0]?.count ?? 0}</span>
                    </TableCell>
                    <TableCell numeric>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Open ${agency.name}`}
                        title="Open"
                        render={<Link href={`/admin/agencies/${agency.id}`} />}
                      >
                        <ChevronRight />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
