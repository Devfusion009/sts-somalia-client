import { formatMoney } from "@/modules/umrah/pricing";
import { cn } from "@/lib/utils";

/** Reconcile an agreed quote with the unchanged catalog service lines. */
export function PriceAdjustment({
  total,
  lines,
  currency,
  className,
}: {
  total: number;
  lines: { line_total: number | string }[];
  currency: string;
  className?: string;
}) {
  const adjustment = Math.round((total - lines.reduce((sum, line) => sum + Number(line.line_total), 0)) * 100) / 100;
  if (adjustment === 0) return null;

  return (
    <li className={cn("flex items-center justify-between gap-3 text-sm", className)}>
      <span className="font-medium">Price adjustment</span>
      <span className="tabular-nums">{formatMoney(adjustment, currency)}</span>
    </li>
  );
}
