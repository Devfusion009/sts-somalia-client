import styles from "./agent-typography.module.css";

/** Keep the existing currency/rounding rules while separating visual emphasis. */
export function AgentMoney({ value }: { value: string }) {
  const match = /^([A-Z]{3})\s+(.+)$/.exec(value);
  if (!match) return <span className={styles.amount}>{value}</span>;
  return (
    <span className={styles.amount}>
      <span className={styles.currency}>{match[1]}</span>{" "}
      <span>{match[2]}</span>
    </span>
  );
}
