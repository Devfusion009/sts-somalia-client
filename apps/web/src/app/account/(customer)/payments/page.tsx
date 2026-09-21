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
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">Payments &amp; Receipts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your saved payment details, every receipt, and the status of any refund.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-bold">Saved payment methods</h2>
        <SavedMethodsManager methods={methods} />
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-bold">Receipts &amp; invoices</h2>

        {receipts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
                <ReceiptText className="size-5" />
              </span>
              <p className="font-medium">No receipts yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Once you complete a booking, its invoice and payment record appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {receipts.map((receipt) => {
                  const invoice = Array.isArray(receipt.invoices)
                    ? receipt.invoices[0]
                    : receipt.invoices;

                  return (
                    <li
                      key={receipt.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/account/bookings/${receipt.id}`}
                          className="font-medium hover:underline"
                        >
                          {receipt.order_number}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {receipt.paid_at
                            ? `Paid ${format(new Date(receipt.paid_at), "d MMM yyyy")}`
                            : `Created ${format(new Date(receipt.created_at), "d MMM yyyy")}`}
                          {invoice ? ` · Invoice ${invoice.invoice_number}` : ""}
                        </p>
                      </div>
                      <StatusBadge status={receipt.status} />
                      <span className="font-medium tabular-nums">
                        {formatMoney(receipt.total, receipt.currency)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={!invoice}
                        render={
                          invoice ? (
                            <a
                              href={`/api/invoices/${receipt.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          ) : undefined
                        }
                      >
                        <Download className="size-3.5" /> Invoice
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-bold">Refunds</h2>

        {!hasRefundActivity ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
                <RotateCcw className="size-5" />
              </span>
              <p className="font-medium">No refunds in progress</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                You can request a refund from any paid booking&apos;s detail page.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {refunds.requests.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Your requests</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border border-t border-border">
                    {refunds.requests.map((request) => (
                      <li
                        key={request.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/account/bookings/${request.order_id}`}
                            className="font-medium hover:underline"
                          >
                            {request.orders?.order_number ?? "Booking"}
                          </Link>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {request.reason}
                          </p>
                          {request.staff_note ? (
                            <p className="mt-1 text-xs">
                              <span className="font-medium">STS: </span>
                              {request.staff_note}
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-muted-foreground">
                            Requested {format(new Date(request.created_at), "d MMM yyyy")}
                          </p>
                        </div>
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
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            {refunds.settled.length > 0 ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Refunds processed</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border border-t border-border">
                    {refunds.settled.map((payment) => (
                      <li
                        key={payment.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{payment.orders.order_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(payment.updated_at), "d MMM yyyy")}
                          </p>
                        </div>
                        <StatusBadge status={payment.status} />
                        <span className="text-sm font-medium tabular-nums">
                          {formatMoney(payment.amount, payment.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
