import { format } from "date-fns";
import { TableCell, TableRow } from "@/components/ui/table";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Signed ledger amount: the sign carries the direction for readers who
 * can't rely on the green/red, and zero reads as a dash rather than "+ 0.00".
 */
export function SignedMoney({ amount, currency = "USD" }: { amount: number; currency?: string }) {
  if (amount === 0) return <span className="text-muted-foreground">—</span>;
  const negative = amount < 0;
  return (
    <span className={cn("font-medium whitespace-nowrap tabular-nums", negative ? "text-destructive" : "text-primary")}>
      <span aria-hidden="true">{negative ? "− " : "+ "}</span>
      <span className="sr-only">{negative ? "Debit " : "Credit "}</span>
      {money(Math.abs(amount), currency)}
    </span>
  );
}

/** Splits newest-first rows into calendar-month runs, keeping row order. */
export function groupByMonth<T>(rows: T[], dateOf: (row: T) => string) {
  const groups: { key: string; label: string; rows: T[] }[] = [];
  for (const row of rows) {
    const date = new Date(dateOf(row));
    const key = format(date, "yyyy-MM");
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else groups.push({ key, label: format(date, "MMMM yyyy"), rows: [row] });
  }
  return groups;
}

/** Month divider inside a ledger table body. */
export function MonthRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell colSpan={colSpan} className="py-1.5 text-xs font-medium text-muted-foreground">
        <span role="heading" aria-level={3}>
          {label}
        </span>
      </TableCell>
    </TableRow>
  );
}
