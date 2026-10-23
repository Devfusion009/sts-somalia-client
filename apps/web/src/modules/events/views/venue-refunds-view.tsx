import Link from "next/link";
import { format } from "date-fns";
import { getVenueRefundRules, getVenueRequests, type VenueRequest } from "@/modules/events/venue-refund-queries";
import { decideHallBookingRequest, deleteVenueRefundRule, saveVenueRefundRule } from "@/modules/events/venue-refund-actions";
import type { VenueAccess } from "@/modules/events/venue-access";
import { RefundRulesEditor } from "@/modules/hotels/components/refund-rules-editor";
import { RequestDecision } from "@/modules/hotels/components/request-decision";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { hallSlotLabel } from "@/modules/events/venue-desk-types";

const KIND_LABEL: Record<VenueRequest["kind"], string> = {
  cancellation: "Cancellation",
  refund: "Refund",
  modification: "Change",
};

const STATUS_BADGE: Record<string, string> = {
  requested: "bg-brand-gold/15 text-brand-gold",
  in_review: "bg-brand-gold/15 text-brand-gold",
  approved: "bg-primary/10 text-primary",
  completed: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  withdrawn: "bg-muted text-muted-foreground",
};

function money(currency: string, amount: number) {
  return `${currency} ${amount.toFixed(2)}`;
}

function RequestCard({
  request,
  venueId,
  base,
  canDecide,
}: {
  request: VenueRequest;
  venueId: string;
  base: string;
  canDecide: boolean;
}) {
  const open = request.status === "requested" || request.status === "in_review";
  const quote = request.quote;
  const dates = hallSlotLabel({ start_date: request.startDate, end_date: request.endDate, start_time: null, end_time: null });

  return (
    <li className="space-y-3 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`${base}/bookings/${request.bookingId}`} className="font-medium hover:text-primary hover:underline">
              {request.clientName}
            </Link>
            <Badge variant="outline">{KIND_LABEL[request.kind]}</Badge>
            <Badge className={cn("border-transparent capitalize", STATUS_BADGE[request.status] ?? "bg-muted text-muted-foreground")}>
              {request.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {request.eventLabel} · {dates} · {money(request.currency, request.price)}
            {request.orderNumber ? ` · ${request.orderNumber}` : ""}
          </p>
        </div>
        {open && canDecide ? (
          <RequestDecision
            scopeId={venueId}
            scopeName="venueId"
            action={decideHallBookingRequest}
            requestId={request.id}
            kind={request.kind}
            currency={request.currency}
            suggestedAmount={quote?.refundAmount ?? request.requestedAmount ?? 0}
            maxAmount={quote?.paidAmount ?? request.price}
          />
        ) : null}
      </div>

      <p className="rounded-lg bg-secondary/40 px-3 py-2 text-sm">{request.reason}</p>

      {open && request.kind !== "modification" ? (
        <dl className="grid gap-px overflow-hidden rounded-lg bg-border text-sm sm:grid-cols-3">
          <div className="bg-card px-3 py-2">
            <dt className="text-xs text-muted-foreground">Client asked</dt>
            <dd className="font-medium">
              {request.requestedAmount !== null ? money(request.currency, request.requestedAmount) : "Policy amount"}
            </dd>
          </div>
          <div className="bg-card px-3 py-2">
            <dt className="text-xs text-muted-foreground">Policy refund today</dt>
            <dd className="font-medium">
              {quote?.refundAmount != null
                ? `${money(request.currency, quote.refundAmount)} (${quote.deductionPercent}% deducted)`
                : "No rules set"}
            </dd>
          </div>
          <div className="bg-card px-3 py-2">
            <dt className="text-xs text-muted-foreground">Paid</dt>
            <dd className="font-medium">{quote ? money(request.currency, quote.paidAmount) : "—"}</dd>
          </div>
        </dl>
      ) : null}

      {!open ? (
        <p className="text-sm text-muted-foreground">
          {request.approvedAmount !== null ? `Refund ${money(request.currency, request.approvedAmount)} · ` : ""}
          {request.resolvedAt ? format(new Date(request.resolvedAt), "d MMM yyyy") : ""}
          {request.staffNote ? ` · ${request.staffNote}` : ""}
        </p>
      ) : null}
    </li>
  );
}

export async function VenueRefundsView({ venueId, base, access }: { venueId: string; base: string; access: VenueAccess }) {
  const [requests, rules] = await Promise.all([getVenueRequests(venueId), getVenueRefundRules(venueId)]);
  const open = requests.filter((r) => r.status === "requested" || r.status === "in_review");
  const closed = requests.filter((r) => r.status !== "requested" && r.status !== "in_review");

  const rulesCard = (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Refund rules</CardTitle>
      </CardHeader>
      <CardContent>
        <RefundRulesEditor
          scopeId={venueId}
          scopeName="venueId"
          rules={rules}
          canEdit={access.can("profile")}
          saveAction={saveVenueRefundRule}
          deleteAction={deleteVenueRefundRule}
          anchor="the event"
        />
      </CardContent>
    </Card>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              Requests
              {open.length > 0 ? <Badge className="border-transparent bg-brand-gold/15 text-brand-gold">{open.length}</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {open.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open requests.</p>
            ) : (
              <ul className="divide-y divide-border">
                {open.map((r) => (
                  <RequestCard key={r.id} request={r} venueId={venueId} base={base} canDecide={access.can("bookings")} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {closed.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {closed.map((r) => (
                  <RequestCard key={r.id} request={r} venueId={venueId} base={base} canDecide={false} />
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
      {rulesCard}
    </div>
  );
}
