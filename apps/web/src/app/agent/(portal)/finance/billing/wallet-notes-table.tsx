import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AgencyWalletNote } from "@/modules/agencies/queries";
import { SignedMoney } from "../ledger-ui";

/** Shared table for Billing's credit-note and debit-note tabs — same shape, different sign. */
export function WalletNotesTable({
  notes,
  emptyIcon: EmptyIcon,
  emptyTitle,
}: {
  notes: AgencyWalletNote[];
  emptyIcon: LucideIcon;
  emptyTitle: string;
}) {
  return (
    <Card className="overflow-hidden py-0">
      {notes.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <EmptyIcon />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Note</TableHead>
              <TableHead numeric>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.map((note) => (
              <TableRow key={note.id}>
                <TableCell className="font-mono text-xs font-medium">{note.document_number ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(note.created_at), "d MMM yyyy")}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{note.order?.order_number ?? "—"}</TableCell>
                <TableCell className="max-w-[280px] truncate text-muted-foreground" title={note.note ?? ""}>
                  {note.note ?? "—"}
                </TableCell>
                <TableCell numeric>
                  <SignedMoney amount={Number(note.amount)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
