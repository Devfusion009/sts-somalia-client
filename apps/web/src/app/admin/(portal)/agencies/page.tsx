import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Building2, ChevronRight } from "lucide-react";
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
import { MarkupApprovalQueue, type MarkupQueueItem } from "./markup-approval-queue";

export const metadata: Metadata = { title: "Agencies" };

export default async function AdminAgenciesPage() {
  await requirePlatformAdmin();
  const [agencies, { requests: pendingRequests, currentRules }] = await Promise.all([
    getAllAgenciesForAdmin(),
    getPendingMarkupRequestsForAdmin(),
  ]);
  const pendingByAgency = new Map<string, number>();
  for (const request of pendingRequests) {
    pendingByAgency.set(request.agency_id, (pendingByAgency.get(request.agency_id) ?? 0) + 1);
  }
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
        title="Agencies"
        status={
          <Badge variant="neutral" className="tabular-nums">
            {agencies.length}
          </Badge>
        }
      />

      {queueItems.length > 0 ? <MarkupApprovalQueue items={queueItems} /> : null}

      <Card className="overflow-hidden py-0">
        {agencies.length === 0 ? (
          <Empty>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>No agencies</EmptyTitle>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead numeric>Commission</TableHead>
                <TableHead numeric>Balance</TableHead>
                <TableHead numeric>Credit limit</TableHead>
                <TableHead numeric>Members</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agencies.map((agency) => {
                const pending = pendingByAgency.get(agency.id) ?? 0;
                const balance = Number(agency.credit_balance);
                return (
                  <TableRow key={agency.id}>
                    <TableCell className="max-w-72">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Link
                          href={`/admin/agencies/${agency.id}`}
                          className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {agency.name}
                        </Link>
                        {pending > 0 ? (
                          <Badge
                            variant="warning"
                            className="tabular-nums"
                            render={<Link href={`/admin/agencies/${agency.id}#markups`} />}
                          >
                            {pending} markup {pending === 1 ? "request" : "requests"}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{agency.contact_email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(agency.status)} className="capitalize">
                        {agency.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{agency.agency_tiers?.name ?? "—"}</TableCell>
                    <TableCell numeric className="tabular-nums">
                      {agency.commission_rate}%
                    </TableCell>
                    <TableCell
                      numeric
                      className={cn("font-medium tabular-nums", balance < 0 ? "text-destructive" : undefined)}
                    >
                      {money(balance, "USD")}
                    </TableCell>
                    <TableCell numeric className="tabular-nums text-muted-foreground">
                      {money(agency.credit_limit, "USD")}
                    </TableCell>
                    <TableCell numeric className="tabular-nums">
                      {agency.agency_members?.[0]?.count ?? 0}
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
