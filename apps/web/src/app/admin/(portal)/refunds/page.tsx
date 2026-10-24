import type { Metadata } from "next";
import { format } from "date-fns";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getPendingRefundRequestsForAdmin, getRecentReviewedRefundRequestsForAdmin } from "@/modules/agencies/queries";
import { History, Inbox, Undo2, type LucideIcon } from "lucide-react";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefundRequestActions } from "./refund-request-actions";
import { CustomerRequestActions } from "./customer-request-actions";
import { money } from "@/lib/money";

export const metadata: Metadata = { title: "Refund Requests" };

const DATE_TIME = "d MMM yyyy, HH:mm";

export default async function AdminRefundsPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const [pending, reviewed, { data: customerRequests }] = await Promise.all([
    getPendingRefundRequestsForAdmin(),
    getRecentReviewedRefundRequestsForAdmin(),
    supabase
      .from("booking_requests")
      .select(
        `id, kind, status, reason, requested_amount, approved_amount, currency, created_at,
         order:orders(order_number),
         requester:profiles!booking_requests_requested_by_fkey(full_name, email)`
      )
      .in("status", ["requested", "in_review", "approved"])
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  const customer = customerRequests ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Refund Requests" />

      <Section title="Customer requests" count={customer.length}>
        {customer.length === 0 ? (
          <SectionEmpty icon={Inbox} title="No open customer requests" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead numeric>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customer.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="text-muted-foreground">{format(new Date(req.created_at), DATE_TIME)}</TableCell>
                  <TableCell className="font-medium">{req.requester?.full_name ?? req.requester?.email ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{req.order?.order_number ?? "—"}</TableCell>
                  <TableCell className="capitalize">{req.kind}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-muted-foreground" title={req.reason}>
                    {req.reason}
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {req.approved_amount !== null
                      ? money(Number(req.approved_amount), req.currency)
                      : req.requested_amount !== null
                        ? money(Number(req.requested_amount), req.currency)
                        : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(req.status)} className="capitalize">
                      {req.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell numeric>
                    <CustomerRequestActions
                      requestId={req.id}
                      status={req.status}
                      kind={req.kind}
                      currency={req.currency}
                      suggestedAmount={Number(req.approved_amount ?? req.requested_amount ?? 0)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title="Agency requests" count={pending.length}>
        {pending.length === 0 ? (
          <SectionEmpty icon={Undo2} title="No pending agency requests" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead numeric>Amount</TableHead>
                <TableHead numeric>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="text-muted-foreground">{format(new Date(req.created_at), DATE_TIME)}</TableCell>
                  <TableCell>
                    <p className="font-medium">{req.agency?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{req.requester?.full_name ?? req.requester?.email}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{req.order?.order_number ?? "—"}</TableCell>
                  <TableCell className="max-w-[260px] truncate text-muted-foreground" title={req.reason}>
                    {req.reason}
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {money(Number(req.amount), req.currency)}
                  </TableCell>
                  <TableCell numeric>
                    <RefundRequestActions requestId={req.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section title="Recently reviewed">
        {reviewed.length === 0 ? (
          <SectionEmpty icon={History} title="Nothing reviewed" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reviewed</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>Order</TableHead>
                <TableHead numeric>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviewed.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="text-muted-foreground">
                    {req.reviewed_at ? format(new Date(req.reviewed_at), "d MMM yyyy") : "—"}
                  </TableCell>
                  <TableCell className="font-medium">{req.agency?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{req.order?.order_number ?? "—"}</TableCell>
                  <TableCell numeric className="font-medium">
                    {money(Number(req.amount), req.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(req.status)} className="capitalize">
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground" title={req.review_notes ?? ""}>
                    {req.review_notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b border-border py-3.5">
        <CardTitle>{title}</CardTitle>
        {count ? (
          <CardAction>
            <Badge variant="warning" className="tabular-nums">
              {count}
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      {children}
    </Card>
  );
}

function SectionEmpty({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <Empty className="py-10 md:py-10">
      <EmptyMedia variant="icon">
        <Icon />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
    </Empty>
  );
}
