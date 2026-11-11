import { ArrowRight } from "lucide-react";
import { AGENT_BOOKING_STEPS } from "@/modules/agencies/services";
import styles from "./workspace.module.css";

export function BookingWorkflow() {
  return (
    <ol className={styles.workflow} aria-label="Booking workflow">
      {AGENT_BOOKING_STEPS.map((label, index) => (
        <li key={label}>
          <span className={styles.workflowNumber} aria-hidden="true">{index + 1}</span>
          <span>{label}</span>
          {index < AGENT_BOOKING_STEPS.length - 1 ? <ArrowRight className={styles.workflowArrow} aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}
