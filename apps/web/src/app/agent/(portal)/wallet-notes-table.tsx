import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AgencyWalletNote } from "@/modules/agencies/queries";

/** Shared table for /agent/credit-notes and /agent/debit-notes — same shape, different sign/emptyState copy. */
export function WalletNotesTable({
  notes,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
}: {
  notes: AgencyWalletNote[];
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <Card className="overflow-hidden py-0">
      {notes.length === 0 ? (
        <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
          <EmptyIcon className="size-8 text-muted-foreground" />
          <p className="font-medium">{emptyTitle}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{emptyDescription}</p>
        </CardContent>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map((note) => (
                <TableRow key={note.id}>
                  <TableCell className="font-mono text-xs font-medium">{note.document_number ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(note.created_at), "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{note.order?.order_number ?? "—"}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm text-muted-foreground" title={note.note ?? ""}>
                    {note.note ?? "—"}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${Number(note.amount) < 0 ? "text-destructive" : "text-primary"}`}>
                    {Number(note.amount) < 0 ? "−" : "+"} USD {Math.abs(Number(note.amount)).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
