import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Wallet, Hourglass, Smartphone, FileText, ReceiptText, RotateCcw, Download } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getServerTrpc } from "@/lib/trpc/server";
import type { CheckoutOrderRow } from "api/dist/modules/payments/checkout.service";
import { SavedMethodsManager } from "@/modules/payments/components/saved-methods-manager";
import { AccountInvoicePreview } from "@/modules/payments/components/account-invoice-preview";
import { receiptSummary,receiptAmounts,receiptInvoice,filterReceipts,receiptPage,receiptHref,receiptDate,parseReceiptFilters,type ReceiptRecord } from "@/modules/payments/account-workspace";
import { StatusBadge, formatMoney, TYPE_ICON, TYPE_LABEL } from "@/modules/bookings/components/booking-shared";
import type { BookingType } from "@/modules/bookings/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const metadata: Metadata = { title: "Payments & Receipts" };

export default async function AccountPaymentsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const profile=await requireUser();
  const filters=parseReceiptFilters(await searchParams);
  const trpc=await getServerTrpc();
  let methods, receipts, refunds;
  try {
    [methods,receipts,refunds]=await Promise.all([
      trpc.payments.account.savedMethods.query(),
      trpc.payments.account.receipts.query(),
      trpc.payments.account.refunds.query(),
    ]);
  } catch { return <UnavailableNotice label="Payments & Receipts" />; }
  const rows:ReceiptRecord[]=receipts.map(row=>({...row,invoices:Array.isArray(row.invoices) ? row.invoices : row.invoices ? [row.invoices]:[]}));
  const summary=receiptSummary(rows);
  const filtered=filterReceipts(rows,filters);
  const pageSize=10, page=receiptPage(filters,filtered.length,pageSize), pageCount=Math.max(1,Math.ceil(filtered.length/pageSize));
  const visible=filtered.slice((page-1)*pageSize,page*pageSize);
  const selected=filtered.find(row=>row.id===filters.invoice) ?? visible[0] ?? null;
  const selectedIndex=selected ? filtered.findIndex(row=>row.id===selected.id) : -1;
  const selectHref=(index:number)=>receiptHref(filters,{invoice:filtered[index]?.id,page:String(Math.floor(index/pageSize)+1)})+"#invoice-preview";
  let selectedOrder:CheckoutOrderRow|null=null;
  if(selected) {
    try { selectedOrder=await trpc.payments.orderForCheckout.query({orderId:selected.id}) as unknown as CheckoutOrderRow|null; } catch { /* Keep the payment list available if the preview fails. */ }
  }
  const hasRefundActivity=refunds.requests.length>0 || refunds.settled.length>0;
  const stats=[
    {label:"Payments received",icon:Wallet,amounts:summary.paid,value:undefined},
    {label:"Pending balance",icon:Hourglass,amounts:summary.pending,value:undefined},
    {label:"Saved wallets",icon:Smartphone,amounts:null,value:methods.length},
    {label:"Invoices",icon:FileText,amounts:null,value:summary.invoices},
  ];
  return (<div className="mx-auto w-full max-w-7xl space-y-5">
    <PageHeader title="Payments & receipts" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(stat=><Card key={stat.label} className="flex-row items-start gap-4 p-5"><span className={`grid size-12 shrink-0 place-items-center rounded-xl ${stat.icon===Hourglass ? "bg-amber-500/10 text-amber-600":"bg-primary/10 text-primary"}`}><stat.icon className="size-6" aria-hidden /></span><div className="min-w-0"><div className="text-xs text-muted-foreground">{stat.label}</div><div className="mt-2 space-y-1 text-lg font-semibold tabular-nums">{stat.amounts ? stat.amounts.length ? stat.amounts.map(amount=><div key={amount.currency}>{formatMoney(amount.amount,amount.currency)}</div>):<span>—</span> : stat.value}</div></div></Card>)}</div>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,1fr)]">
      <div className="min-w-0 space-y-5">
        <SavedMethodsManager methods={methods} />
        <Card className="overflow-hidden">
          <CardHeader><CardTitle className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><ReceiptText className="size-5" aria-hidden /></span>Receipts & invoices</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form key={receiptHref(filters)} className="flex flex-wrap items-end gap-2" role="search">
              <div className="min-w-52 flex-1"><label htmlFor="receipt-search" className="sr-only">Search receipts</label><Input id="receipt-search" name="q" defaultValue={filters.q} maxLength={100} placeholder="Booking or invoice reference" /></div>
              <div><label htmlFor="receipt-status" className="sr-only">Booking status</label><select id="receipt-status" name="status" defaultValue={filters.status ?? "all"} className={NATIVE_SELECT_CLASS}><option value="all">All statuses</option><option value="paid">Paid</option><option value="pending">Pending payment</option><option value="refunded">Refunded</option><option value="cancelled">Cancelled</option></select></div>
              <div><label htmlFor="receipt-days" className="sr-only">Receipt date range</label><select id="receipt-days" name="days" defaultValue={filters.days ?? "all"} className={NATIVE_SELECT_CLASS}><option value="all">All dates</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option></select></div>
              <div><label htmlFor="receipt-sort" className="sr-only">Receipt sort order</label><select id="receipt-sort" name="sort" defaultValue={filters.sort ?? "newest"} className={NATIVE_SELECT_CLASS}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
              <Button variant="outline" type="submit" size="sm">Apply</Button>
              {filters.q || filters.status && filters.status!=="all" || filters.days && filters.days!=="all" ? <Link href="/account/payments" className="px-2 py-2 text-xs text-muted-foreground hover:underline">Reset</Link> : null}
            </form>
            {visible.length===0 ? <Empty><EmptyHeader><EmptyMedia variant="icon"><ReceiptText /></EmptyMedia><EmptyTitle>{rows.length ? "No matching invoices":"No payments or invoices"}</EmptyTitle></EmptyHeader></Empty> : <div className="overflow-hidden rounded-xl border"><Table><TableHeader><TableRow><TableHead>Booking · service</TableHead><TableHead>Invoice · date</TableHead><TableHead>Booking status</TableHead><TableHead numeric>Amount</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{visible.map(row=>{
              const invoice=receiptInvoice(row), amounts=receiptAmounts(row);
              const types=[...new Set(row.order_items.map(item=>item.item_type))];
              return <TableRow key={row.id} className={row.id===selected?.id ? "bg-primary/[0.06] hover:bg-primary/[0.08]":undefined}>
                <TableCell><Link href={`/account/bookings/${row.id}`} className="whitespace-nowrap font-mono text-xs font-semibold hover:text-primary hover:underline">{row.order_number}</Link><div className="mt-2 flex flex-wrap gap-2">{types.map(type=>{const Icon=TYPE_ICON[type as BookingType] ?? FileText;return <span key={type} className="flex items-center gap-1 text-xs text-muted-foreground"><Icon className="size-3.5 text-primary" aria-hidden />{TYPE_LABEL[type as BookingType] ?? type}</span>;})}</div></TableCell>
                <TableCell><div className="whitespace-nowrap font-mono text-xs">{invoice?.invoice_number ?? (["cancelled","refunded"].includes(row.status) ? "No invoice":"Proforma")}</div><div className="mt-2 whitespace-nowrap text-xs text-muted-foreground">{row.paid_at ? "Paid":"Created"} {format(new Date(receiptDate(row)),"d MMM yyyy")}</div></TableCell>
                <TableCell><StatusBadge status={row.status} /></TableCell>
                <TableCell numeric className="whitespace-nowrap"><div className="text-sm font-semibold tabular-nums">{formatMoney(row.total,row.currency)}</div>{amounts.due>0 ? <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">{formatMoney(amounts.due,row.currency)} due</div>:amounts.refunded>0 ? <div className="mt-1 text-xs text-muted-foreground">{formatMoney(amounts.refunded,row.currency)} refunded</div>:null}</TableCell>
                <TableCell><div className="flex items-center gap-1"><Button size="sm" variant="outline" aria-label={`View invoice for ${row.order_number}`} aria-current={row.id===selected?.id ? "true":undefined} render={<Link href={selectHref(filtered.findIndex(item=>item.id===row.id))} />}>View</Button>{invoice || !["cancelled","refunded"].includes(row.status) ? <Button size="icon" variant="ghost" aria-label={`Download ${invoice?.invoice_number ?? `proforma ${row.order_number}`}`} render={<a href={`/api/invoices/${row.id}`} target="_blank" rel="noopener noreferrer" />}><Download className="size-4" /></Button>:null}</div></TableCell>
              </TableRow>;
            })}</TableBody></Table></div>}
            {pageCount>1 ? <nav aria-label="Invoice pages" className="flex items-center justify-between gap-3 text-sm"><Button variant="outline" size="sm" disabled={page===1} render={page>1 ? <Link href={receiptHref(filters,{page:String(page-1),invoice:""})} />:undefined}>Previous</Button><span className="text-xs text-muted-foreground">Page {page} of {pageCount} · {filtered.length} orders</span><Button variant="outline" size="sm" disabled={page===pageCount} render={page<pageCount ? <Link href={receiptHref(filters,{page:String(page+1),invoice:""})} />:undefined}>Next</Button></nav>:null}
          </CardContent>
        </Card>
      </div>
      <AccountInvoicePreview receipt={selected} order={selectedOrder} customer={selectedOrder?.customer_id===profile.id ? profile:{full_name:"Booking customer",email:null,phone:null}} previousHref={selectedIndex>0 ? selectHref(selectedIndex-1):null} nextHref={selectedIndex>=0 && selectedIndex<filtered.length-1 ? selectHref(selectedIndex+1):null} position={selectedIndex+1} total={filtered.length} />
    </div>
      {!hasRefundActivity ? <Card className="flex-row items-center gap-3 p-5"><RotateCcw className="size-5 text-muted-foreground" aria-hidden /><span className="text-sm text-muted-foreground">No refund activity</span></Card> : (

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
                <CardTitle>Refunded payments</CardTitle>
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
                          <span className="block text-xs font-normal text-muted-foreground">Original payment</span>
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
