import { CheckCircle2, CircleX, Clock3, Undo2 } from "lucide-react";

const statuses = {
  paid: { label: "Paid", Icon: CheckCircle2, style: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  failed: { label: "Failed", Icon: CircleX, style: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200" },
  pending: { label: "Pending", Icon: Clock3, style: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  refunded: { label: "Refunded", Icon: Undo2, style: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" },
};

export function PaymentStatusBadge({ status }: { status: keyof typeof statuses }) {
  const { label, Icon, style } = statuses[status];
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}><Icon size={14} aria-hidden="true" />{label}</span>;
}
