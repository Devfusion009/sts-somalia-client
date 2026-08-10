import type { Metadata } from "next";
import { format } from "date-fns";
import { Download, FileText } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyAgency, getAgencyInvoices } from "@/modules/agencies/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My Invoices" };

const STATUS_STYLES: Record<string, string> = {
  issued: "bg-primary/10 text-primary",
  paid: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  void: "bg-destructive/10 text-destructive",
};

export default async function AgentInvoicesPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const invoices = await getAgencyInvoices(membership.agency.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">My Invoices</h1>
        <p className="text-sm text-muted-foreground">Every invoice issued against {membership.agency.name}&apos;s orders.</p>
      </div>

      <Card className="overflow-hidden py-0">
        {invoices.length === 0 ? (
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <FileText className="size-8 text-muted-foreground" />
            <p className="font-medium">No invoices yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              An invoice is issued automatically the moment an order is paid.
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-xs font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{invoice.order?.order_number ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {invoice.issued_at ? format(new Date(invoice.issued_at), "d MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {invoice.currency} {Number(invoice.total).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("border-transparent capitalize", STATUS_STYLES[invoice.status] ?? "")}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        render={<a href={`/api/invoices/${invoice.order?.id}`} target="_blank" rel="noopener noreferrer" />}
                      >
                        <Download className="size-3.5" /> PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
