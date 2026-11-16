import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, FileText, ArrowUpRight } from "lucide-react";
import type { CheckoutOrderRow } from "api/dist/modules/payments/checkout.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { money, shortDate } from "@/lib/money";
import { StatusBadge } from "@/modules/bookings/components/booking-shared";
import { describeOrderItem } from "@/modules/orders/format";
import { receiptAmounts, receiptInvoice, type ReceiptRecord } from "../account-workspace";

type Props = {
  receipt: ReceiptRecord | null;
  order: CheckoutOrderRow | null;
  customer: {full_name:string|null;email:string|null;phone:string|null};
  previousHref:string|null;
  nextHref:string|null;
  position:number;
  total:number;
};

export function AccountInvoicePreview({receipt,order,customer,previousHref,nextHref,position,total}:Props) {
  const invoice=receipt ? receiptInvoice(receipt) : null;
  const closed=order?.status==="cancelled" || order?.status==="refunded";
  const downloadable=Boolean(receipt && (invoice || !closed));
  const amounts=receipt ? receiptAmounts(receipt):null;
  return <Card id="invoice-preview" className="scroll-mt-20 xl:sticky xl:top-20">
    <CardHeader><CardTitle className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="size-5" aria-hidden /></span>{!receipt || invoice ? "Invoice preview" : closed ? "Booking summary" : "Proforma preview"}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {!receipt ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No invoice selected</div> : !order ? <div role="status" className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">Invoice preview is currently unavailable.</div> : <div className="space-y-6 rounded-xl border bg-background p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5"><div className="flex items-center gap-2"><Image src="/logo-icon.png" alt="" width={36} height={36} /><span className="text-sm font-semibold">STS Somalia</span></div><div className="text-right"><div className="text-xs font-semibold uppercase tracking-wide">{invoice ? "Invoice" : closed ? "Booking summary" : "Proforma"}</div><div className="mt-1 break-all font-mono text-xs">{invoice?.invoice_number ?? order.order_number}</div><div className="mt-2"><StatusBadge status={order.status} /></div></div></div>
        <div className="grid gap-4 text-xs sm:grid-cols-2"><div><div className="mb-2 text-muted-foreground">Billed to</div><div className="font-semibold">{customer.full_name ?? "Customer"}</div>{customer.email ? <div className="mt-1 break-all text-muted-foreground">{customer.email}</div> : null}{customer.phone ? <div className="mt-1 text-muted-foreground">{customer.phone}</div> : null}</div><dl className="space-y-2"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">{invoice ? "Issue date":"Created"}</dt><dd>{shortDate(invoice?.issued_at ?? order.created_at)}</dd></div>{order.paid_at ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Paid date</dt><dd>{shortDate(order.paid_at)}</dd></div> : null}<div className="flex justify-between gap-3"><dt className="text-muted-foreground">Booking</dt><dd className="font-mono">{order.order_number}</dd></div></dl></div>
        <div className="overflow-hidden rounded-lg border"><div className="grid grid-cols-[1fr_auto_auto] gap-3 bg-muted/60 px-3 py-2 text-[11px] font-medium text-muted-foreground"><span>Description</span><span>Qty</span><span>Amount</span></div><ul className="divide-y">{order.order_items.map(item=>{const info=describeOrderItem(item);return <li key={item.id} className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-3 text-xs"><div className="min-w-0"><div className="font-medium">{info.title}</div>{info.subtitle ? <div className="mt-1 text-muted-foreground">{info.subtitle}</div>:null}</div><div className="tabular-nums">{item.quantity}</div><div className="whitespace-nowrap text-right font-medium tabular-nums">{money(item.total_price,order.currency)}</div></li>;})}</ul></div>
        <dl className="space-y-3 text-xs"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{money(order.subtotal,order.currency)}</dd></div>{Number(order.markup_amount)>0 ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Service fee</dt><dd className="tabular-nums">{money(order.markup_amount,order.currency)}</dd></div> : null}{Number(order.fee_total)>0 ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Processing fee</dt><dd className="tabular-nums">{money(order.fee_total,order.currency)}</dd></div> : null}{Number(order.tax_total)>0 ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Taxes</dt><dd className="tabular-nums">{money(order.tax_total,order.currency)}</dd></div> : null}{Number(order.discount_total)>0 ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Discount</dt><dd className="tabular-nums">−{money(order.discount_total,order.currency)}</dd></div> : null}<div className="flex justify-between gap-3 border-t pt-3 text-sm font-semibold"><dt>Order total</dt><dd className="tabular-nums">{money(order.total,order.currency)}</dd></div><div className="flex justify-between gap-3 rounded-lg bg-primary/10 p-3 font-semibold text-primary"><dt>Payments received</dt><dd className="tabular-nums">{money(amounts?.paid ?? 0,order.currency)}</dd></div>{(amounts?.refunded ?? 0)>0 ? <><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Refunded</dt><dd className="tabular-nums">−{money(amounts!.refunded,order.currency)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Net paid</dt><dd className="tabular-nums">{money(amounts!.netPaid,order.currency)}</dd></div></>:null}{(amounts?.due ?? 0)>0 ? <div className="flex justify-between gap-3 rounded-lg bg-amber-500/10 p-3 font-semibold text-amber-800 dark:text-amber-200"><dt>Balance due</dt><dd className="tabular-nums">{money(amounts!.due,order.currency)}</dd></div>:null}</dl>
        {!invoice && !closed ? <Badge variant="neutral">Proforma · not a receipt</Badge>:invoice?.status==="void" ? <Badge variant="neutral">Voided invoice</Badge>:null}
        <Link href={`/account/bookings/${order.id}`} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">Open booking <ArrowUpRight className="size-3" aria-hidden /></Link>
      </div>}
      {receipt ? <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Button size="icon" variant="outline" disabled={!previousHref} aria-label="Previous invoice" render={previousHref ? <Link href={previousHref} />:undefined}><ChevronLeft /></Button><span className="text-xs text-muted-foreground tabular-nums">{position} of {total}</span><Button size="icon" variant="outline" disabled={!nextHref} aria-label="Next invoice" render={nextHref ? <Link href={nextHref} />:undefined}><ChevronRight /></Button></div>{downloadable ? <Button size="sm" render={<a href={`/api/invoices/${receipt.id}`} target="_blank" rel="noopener noreferrer" />}><Download />{invoice ? "Download PDF":"Download proforma"}</Button> : null}</div>:null}
    </CardContent>
  </Card>;
}
