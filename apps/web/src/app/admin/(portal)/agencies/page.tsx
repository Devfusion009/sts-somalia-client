import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getAllAgenciesForAdmin, getPendingMarkupRequestsForAdmin } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

const STATUS_STYLES: Record<string, string> = {
  active: "bg-primary/10 text-primary",
  pending: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

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
      <div className="flex items-center gap-2">
        <h1 className="font-heading text-2xl font-semibold">Agencies</h1>
        <Badge variant="secondary">{agencies.length}</Badge>
      </div>

      {queueItems.length > 0 ? <MarkupApprovalQueue items={queueItems} /> : null}

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
                <TableHead className="text-right">Members</TableHead>
                <TableHead className="text-right">Manage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agencies.map((agency) => {
                const pending = pendingByAgency.get(agency.id) ?? 0;
                return (
                  <TableRow key={agency.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{agency.name}</p>
                        {pending > 0 ? (
                          <Link href={`/admin/agencies/${agency.id}#markups`}>
                            <Badge className="border-transparent bg-brand-gold/15 text-brand-gold hover:bg-brand-gold/25">
                              {pending} markup {pending === 1 ? "request" : "requests"}
                            </Badge>
                          </Link>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{agency.contact_email}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "border-transparent capitalize",
                          STATUS_STYLES[agency.status] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {agency.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{agency.agency_tiers?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">{agency.commission_rate}%</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        Number(agency.credit_balance) < 0 ? "text-destructive" : undefined
                      )}
                    >
                      USD {Number(agency.credit_balance).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">USD {Number(agency.credit_limit).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{agency.agency_members?.[0]?.count ?? 0}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-primary"
                        render={<Link href={`/admin/agencies/${agency.id}`} />}
                      >
                        Open <ArrowRight className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
