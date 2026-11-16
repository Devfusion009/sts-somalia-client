import { AgentMoney } from "@/components/portal/agent-money";
import { money } from "@/lib/money";
import styles from "./finance.module.css";

type Stage = { label: string; amount: number; tone: "muted" | "review" | "available" | "paid" };

export function EarningsPipeline({
  totalEarned,
  inReview,
  available,
  paidOut,
}: {
  totalEarned: number;
  inReview: number;
  available: number;
  paidOut: number;
}) {
  const stages: Stage[] = [
    { label: "Total earned", amount: totalEarned, tone: "muted" },
    { label: "In review by STS", amount: inReview, tone: "review" },
    { label: "Available to withdraw", amount: available, tone: "available" },
    { label: "Withdrawn or transferred", amount: paidOut, tone: "paid" },
  ];

  return (
    <dl className={styles.earningsGrid}>
      {stages.map((stage) => (
        <div key={stage.label} className={styles.earningMetric} data-tone={stage.tone}>
          <dt><span className={styles.stageDot} aria-hidden="true" />{stage.label}</dt>
          <dd><AgentMoney value={money(stage.amount, "USD")} /></dd>
        </div>
      ))}
    </dl>
  );
}
