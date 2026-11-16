import { format } from "date-fns";
import { Building2, Clock3, FileCheck2, History, Landmark, Coins } from "lucide-react";
import type { AdminOrder } from "@/modules/admin/queries";
import type { PaymentProof } from "@/modules/payments/proof-actions";
import { money } from "@/lib/money";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { BankPaymentReview } from "./bank-payment-review";
import { ConfirmPaymentButton } from "./confirm-payment-button";

export function OrderPaymentsPanel({ order, proofs, historyOnly = false }: { order: AdminOrder; proofs: PaymentProof[]; historyOnly?: boolean }) {
  const active = order.payments.filter(p => ["requires_action", "processing"].includes(p.status));
  const history = order.payments.filter(p => !["requires_action", "processing"].includes(p.status));
  const payable = ["pending_payment", "held", "partially_paid"].includes(order.status);
  return (
    <section aria-label={`Payments for ${order.order_number}`} className="space-y-3">
      {!historyOnly && (active.length ? active.map(payment => {
        const bank = payment.provider === "manual" && payment.method_label === "Bank Transfer";
        const cash = payment.provider === "manual" && !bank;
        const paymentProofs = proofs.filter(p => p.payment_id === payment.id);
        const latest = paymentProofs[0];
        const label = !payable ? "Order closed" : bank ? !latest ? "Waiting for customer proof" : latest.status === "rejected" ? "Waiting for corrected proof" : "Proof ready for review" : cash ? "Awaiting cash collection" : "Awaiting provider confirmation";
        const Icon = bank ? Landmark : cash ? Building2 : Clock3;
        return (
          <div key={payment.id} className="grid gap-4 rounded-xl bg-primary/5 p-4 lg:grid-cols-[1fr_1.4fr_auto] lg:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/8 text-primary"><Icon className="size-4 text-muted-foreground" aria-hidden /></span>
              <div className="min-w-0 space-y-1"><p className="text-xs text-muted-foreground">Payment method</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-sm font-semibold">{payment.method_label ?? "Online payment"}</span>{Number(payment.amount) !== Number(order.total) ? <span className="text-sm font-semibold tabular-nums">{money(payment.amount,payment.currency)}</span> : null}</div>

              </div>
            </div>
            <div className="flex items-center gap-3 lg:border-l lg:border-border lg:pl-5"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/8 text-primary"><Coins className="size-5" aria-hidden="true" /></span><div><p className="mb-1 text-xs text-muted-foreground">Payment note</p>                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300"><span className="size-1.5 rounded-full bg-amber-500" aria-hidden />{label}</div></div></div>
            {payable && payment.status === "requires_action" ? <div className="shrink-0 lg:pl-4">{bank && latest ? <BankPaymentReview paymentId={payment.id} proofs={paymentProofs} amount={money(payment.amount,payment.currency)} orderNumber={order.order_number} /> : cash ? <ConfirmPaymentButton paymentId={payment.id} amount={money(payment.amount,payment.currency)} orderNumber={order.order_number} /> : null}</div> : null}
          </div>
        );
      }) : !["paid", "completed", "processing"].includes(order.status) ? <div className="text-sm text-muted-foreground">{order.payments.some(p => ["refunded", "partially_refunded"].includes(p.status)) ? "Refund recorded" : payable ? "Awaiting customer payment" : null}</div> : null)}
      {historyOnly && history.length ? <details className="group rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"><History className="size-3.5" aria-hidden />Payment history ({history.length})<span className="ml-auto group-open:hidden">Show</span><span className="ml-auto hidden group-open:inline">Hide</span></summary>
        <ul className="divide-y divide-border border-t border-border">{history.map(p => {
          const proof = proofs.find(r => r.payment_id === p.id);
          return <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 text-xs"><span className="font-medium">{p.method_label ?? "Payment"}</span><span className="tabular-nums">{money(p.amount,p.currency)}</span><Badge variant={statusBadgeVariant(p.status)}>{p.status.replace(/_/g," ")}</Badge><time className="text-muted-foreground">{format(new Date(p.created_at),"d MMM yyyy, HH:mm")}</time>{proof ? <a href={`/api/payments/proofs/${proof.id}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"><FileCheck2 className="size-3.5" />View proof</a> : null}</li>;
        })}</ul>
      </details> : null}
    </section>
  );
}
