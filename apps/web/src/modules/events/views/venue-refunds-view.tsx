import Link from "next/link";
import { format } from "date-fns";
import { getVenueRefundRules, getVenueRequests, type VenueRequest } from "@/modules/events/venue-refund-queries";
import { decideHallBookingRequest, deleteVenueRefundRule, saveVenueRefundRule } from "@/modules/events/venue-refund-actions";
import type { VenueAccess } from "@/modules/events/venue-access";
import { RefundRulesEditor } from "@/modules/hotels/components/refund-rules-editor";
import { RequestDecision } from "@/modules/hotels/components/request-decision";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money as formatMoney } from "@/lib/money";
import { hallSlotLabel } from "@/modules/events/venue-desk-types";

const KIND_LABEL: Record<VenueRequest["kind"], string> = {
  cancellation: "Cancellation",
  refund: "Refund",
  modification: "Change",
};

const STATUS_OVERRIDES = { withdrawn: "neutral" } as const;

function money(currency: string, amount: number) {
  return formatMoney(amount, currency);
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium tabular-nums">{children}</dd>
    </div>
  );
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
            <Link
              href={`${base}/bookings/${request.bookingId}`}
              className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {request.clientName}
            </Link>
            <Badge variant="outline">{KIND_LABEL[request.kind]}</Badge>
            <Badge variant={statusBadgeVariant(request.status, STATUS_OVERRIDES)} className="capitalize">
              {request.status.replace(/_/g, " ")}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
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
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <Detail label="Client asked">
            {request.requestedAmount !== null ? money(request.currency, request.requestedAmount) : "Policy amount"}
          </Detail>
          <Detail label="Policy refund today">
            {quote?.refundAmount != null
              ? `${money(request.currency, quote.refundAmount)} (${quote.deductionPercent}% deducted)`
              : "No rules set"}
          </Detail>
          <Detail label="Paid">{quote ? money(request.currency, quote.paidAmount) : "—"}</Detail>
        </dl>
      ) : null}

      {!open ? (
        <p className="text-sm text-muted-foreground tabular-nums">
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
            <CardTitle className="text-base">Requests</CardTitle>
            {open.length > 0 ? (
              <CardAction>
                <Badge variant="warning" className="tabular-nums">
                  {open.length}
                </Badge>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {open.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open requests</p>
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
