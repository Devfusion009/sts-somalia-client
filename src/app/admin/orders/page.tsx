import { Fragment } from "react";
import { BadgeCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllOrders } from "@/modules/admin/queries";
import { adminConfirmPayment } from "@/modules/payments/actions";
import { OrderStatusSelect } from "./order-status-select";
import { cn } from "@/lib/utils";

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  succeeded: "bg-primary/10 text-primary",
  requires_action: "bg-brand-gold/15 text-brand-gold",
  processing: "bg-chart-3/10 text-chart-3",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-muted text-muted-foreground",
};

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Orders &amp; Payments</h1>
        <p className="text-sm text-muted-foreground">
          All orders placed across the platform. Confirm bank-transfer and cash payments here once
          the funds arrive.
        </p>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No orders yet.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <Fragment key={order.id}>
                  <TableRow className={order.payments.length > 0 ? "border-b-0" : undefined}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>
                      <p>{order.customer?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{order.customer?.email}</p>
                    </TableCell>
                    <TableCell>
                      {order.currency} {Number(order.total).toFixed(2)}
                    </TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <OrderStatusSelect orderId={order.id} status={order.status} />
                    </TableCell>
                  </TableRow>
                  {order.payments.length > 0 ? (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={5} className="py-2.5">
                        <div className="flex flex-col gap-1.5 pl-4">
                          {order.payments.map((payment) => (
                            <div
                              key={payment.id}
                              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
                            >
                              <span className="font-medium">
                                {payment.method_label ?? payment.provider}
                              </span>
                              <span className="text-muted-foreground">
                                via {payment.provider}
                                {payment.payer_phone ? ` · ${payment.payer_phone}` : ""}
                              </span>
                              <span>
                                {payment.currency} {Number(payment.amount).toFixed(2)}
                              </span>
                              <Badge
                                className={cn(
                                  "border-transparent capitalize",
                                  PAYMENT_STATUS_STYLES[payment.status] ??
                                    "bg-muted text-muted-foreground"
                                )}
                              >
                                {payment.status.replace("_", " ")}
                              </Badge>
                              {payment.status === "requires_action" ? (
                                <form action={adminConfirmPayment}>
                                  <input type="hidden" name="paymentId" value={payment.id} />
                                  <Button size="sm" variant="outline" type="submit" className="gap-1">
                                    <BadgeCheck className="size-3.5 text-primary" />
                                    Confirm payment received
                                  </Button>
                                </form>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
