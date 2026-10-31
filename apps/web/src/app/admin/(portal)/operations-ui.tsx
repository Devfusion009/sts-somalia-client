import { cn } from "@/lib/utils";
import styles from "./operations.module.css";

export function OperationsMetrics({ items }: {
  items: Array<{ label: string; value: React.ReactNode; detail?: React.ReactNode; tone?: "primary" | "warning" | "danger" }>;
}) {
  return (
    <dl className={styles.metrics}>
      {items.map((item) => (
        <div key={item.label} className={cn(styles.metric, item.tone && styles[item.tone])}>
          <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
          <dd className="mt-3 font-heading text-2xl font-semibold tracking-tight tabular-nums lg:text-3xl">{item.value}</dd>
          {item.detail ? <dd className="mt-2 text-xs text-muted-foreground tabular-nums">{item.detail}</dd> : null}
        </div>
      ))}
    </dl>
  );
}
