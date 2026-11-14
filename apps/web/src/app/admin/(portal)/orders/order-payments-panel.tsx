import { format } from "date-fns";
import { Building2, CheckCircle2, Clock3, FileCheck2, History, Landmark } from "lucide-react";
import type { AdminOrder } from "@/modules/admin/queries";
import type { PaymentProof } from "@/modules/payments/proof-actions";
import { money } from "@/lib/money";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { BankPaymentReview } from "./bank-payment-review";
import { ConfirmPaymentButton } from "./confirm-payment-button";

export function OrderPaymentsPanel({ order, proofs }: { order: AdminOrder; proofs: PaymentProof[] }) {
  const active = order.payments.filter(p => ["requires_action", "processing"].includes(p.status));
  const history = order.payments.filter(p => !["requires_action", "processing"].includes(p.status));
  const payable = ["pending_payment", "held", "partially_paid"].includes(order.status);
  return (
    <section aria-label={`Payments for ${order.order_number}`} className="space-y-3 border-t border-border px-4 py-3 sm:px-5">
      {active.length ? active.map(payment => {
        const bank = payment.provider === "manual" && payment.method_label === "Bank Transfer";
        const cash = payment.provider === "manual" && !bank;
        const paymentProofs = proofs.filter(p => p.payment_id === payment.id);
        const latest = paymentProofs[0];
        const label = !payable ? "Order closed" : bank ? !latest ? "Waiting for customer proof" : latest.status === "rejected" ? "Waiting for corrected proof" : "Proof ready for review" : cash ? "Awaiting cash collection" : "Awaiting provider confirmation";
        const Icon = bank ? Landmark : cash ? Building2 : Clock3;
        return (
          <div key={payment.id} className="flex flex-col gap-3 rounded-lg bg-muted/20 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card"><Icon className="size-4 text-muted-foreground" aria-hidden /></span>
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-sm font-semibold">{payment.method_label ?? "Online payment"}</span><span className="text-sm font-semibold tabular-nums">{money(payment.amount,payment.currency)}</span></div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300"><span className="size-1.5 rounded-full bg-amber-500" aria-hidden />{label}</div>
                <div className="text-xs text-muted-foreground">Requested {format(new Date(payment.created_at),"d MMM yyyy, HH:mm")}{latest ? ` · ${paymentProofs.length} proof${paymentProofs.length === 1 ? "" : "s"}` : ""}</div>
              </div>
            </div>
            {payable && payment.status === "requires_action" ? <div className="shrink-0 lg:pl-4">{bank && latest ? <BankPaymentReview paymentId={payment.id} proofs={paymentProofs} amount={money(payment.amount,payment.currency)} orderNumber={order.order_number} /> : cash ? <ConfirmPaymentButton paymentId={payment.id} amount={money(payment.amount,payment.currency)} orderNumber={order.order_number} /> : null}</div> : null}
          </div>
        );
      }) : <div className="flex items-center gap-2 text-sm text-muted-foreground">{order.payments.some(p => p.status === "succeeded") ? <><CheckCircle2 className="size-4 text-primary" aria-hidden />Payment received</> : <><Clock3 className="size-4" aria-hidden />{order.payments.some(p => ["refunded","partially_refunded"].includes(p.status)) ? "Refund recorded" : payable ? "Awaiting customer payment" : "No successful payment"}</>}</div>}
      {history.length ? <details className="group rounded-lg border border-border">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary"><History className="size-3.5" aria-hidden />Payment history ({history.length})<span className="ml-auto group-open:hidden">Show</span><span className="ml-auto hidden group-open:inline">Hide</span></summary>
        <ul className="divide-y divide-border border-t border-border">{history.map(p => {
          const proof = proofs.find(r => r.payment_id === p.id);
          return <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3 text-xs"><span className="font-medium">{p.method_label ?? "Payment"}</span><span className="tabular-nums">{money(p.amount,p.currency)}</span><Badge variant={statusBadgeVariant(p.status)}>{p.status.replace(/_/g," ")}</Badge><time className="text-muted-foreground">{format(new Date(p.created_at),"d MMM yyyy, HH:mm")}</time>{proof ? <a href={`/api/payments/proofs/${proof.id}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-primary underline underline-offset-4"><FileCheck2 className="size-3.5" />View proof</a> : null}</li>;
        })}</ul>
      </details> : null}
    </section>
  );
}
