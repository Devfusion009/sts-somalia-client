import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Download, ReceiptText, RotateCcw } from "lucide-react";
import { getServerTrpc } from "@/lib/trpc/server";
import { SavedMethodsManager } from "@/modules/payments/components/saved-methods-manager";
import { StatusBadge, formatMoney } from "@/modules/bookings/components/booking-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Payments & Receipts" };

export default async function AccountPaymentsPage() {
  const trpc = await getServerTrpc();
  let methods, receipts, refunds;
  try {
    [methods, receipts, refunds] = await Promise.all([
      trpc.payments.account.savedMethods.query(),
      trpc.payments.account.receipts.query(),
      trpc.payments.account.refunds.query(),
    ]);
  } catch {
    return <UnavailableNotice label="Payments & Receipts" />;
  }

  const hasRefundActivity = refunds.requests.length > 0 || refunds.settled.length > 0;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader title="Payments & receipts" />

      <SavedMethodsManager methods={methods} />

      <Card>
        <CardHeader>
          <CardTitle>Receipts &amp; invoices</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {receipts.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ReceiptText />
                </EmptyMedia>
                <EmptyTitle>No receipts</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {receipts.map((receipt) => {
                const invoice = Array.isArray(receipt.invoices)
                  ? receipt.invoices[0]
                  : receipt.invoices;

                return (
                  <li key={receipt.id} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/account/bookings/${receipt.id}`}
                        className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {receipt.order_number}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground tabular-nums">
                        {receipt.paid_at
                          ? `Paid ${format(new Date(receipt.paid_at), "d MMM yyyy")}`
                          : `Created ${format(new Date(receipt.created_at), "d MMM yyyy")}`}
                        {invoice ? ` · ${invoice.invoice_number}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                      <StatusBadge status={receipt.status} />
                      <span className="font-medium tabular-nums">
                        {formatMoney(receipt.total, receipt.currency)}
                      </span>
                    </div>
                    {invoice ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Download invoice ${invoice.invoice_number}`}
                        title="Download invoice"
                        render={
                          <a
                            href={`/api/invoices/${receipt.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        <Download />
                      </Button>
                    ) : (
                      <span className="size-8 shrink-0 max-sm:size-10" aria-hidden="true" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {!hasRefundActivity ? (
        <Card>
          <CardHeader>
            <CardTitle>Refunds</CardTitle>
          </CardHeader>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <RotateCcw />
                </EmptyMedia>
                <EmptyTitle>No refunds</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          {refunds.requests.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Refund requests</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <ul className="divide-y divide-border border-t border-border">
                  {refunds.requests.map((request) => (
                    <li key={request.id} className="flex items-start gap-3 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/account/bookings/${request.order_id}`}
                          className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {request.orders?.order_number ?? "Booking"}
                        </Link>
                        <p className="text-sm text-muted-foreground tabular-nums">
                          Requested {format(new Date(request.created_at), "d MMM yyyy")}
                        </p>
                        {request.reason ? (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{request.reason}</p>
                        ) : null}
                        {request.staff_note ? (
                          <p className="mt-1 text-sm">
                            <span className="font-medium">STS: </span>
                            {request.staff_note}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge status={request.status} />
                        <span className="text-sm font-medium tabular-nums">
                          {/* Approved amount wins once staff have set one — that
                              is the figure actually being paid back, not what
                              was asked for. */}
                          {request.approved_amount != null
                            ? formatMoney(request.approved_amount, request.currency)
                            : request.requested_amount != null
                              ? formatMoney(request.requested_amount, request.currency)
                              : "To be assessed"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {refunds.settled.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Refunds paid</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <ul className="divide-y divide-border border-t border-border">
                  {refunds.settled.map((payment) => (
                    <li key={payment.id} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{payment.orders.order_number}</p>
                        <p className="text-sm text-muted-foreground tabular-nums">
                          {format(new Date(payment.updated_at), "d MMM yyyy")}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge status={payment.status} />
                        <span className="text-sm font-medium tabular-nums">
                          {formatMoney(payment.amount, payment.currency)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
