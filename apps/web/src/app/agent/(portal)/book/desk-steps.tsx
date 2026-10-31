"use client";

import { usePathname } from "next/navigation";
import { CheckIcon } from "lucide-react";
import styles from "../workspace.module.css";

const STEPS = ["Customer", "Service", "Travel details", "Review & pay"] as const;

function currentStep(pathname: string, hasCustomer: boolean) {
  const segments = pathname.split("/").filter(Boolean);
  const rest = segments.slice(segments.indexOf("book") + 1).join("/");
  if (rest.startsWith("order/") || rest.startsWith("batch/")) return 3;
  if (rest) return 2;
  return hasCustomer ? 1 : 0;
}

export function DeskSteps({ hasCustomer }: { hasCustomer: boolean }) {
  const step = currentStep(usePathname(), hasCustomer);
  return (
    <nav aria-label="Booking steps">
      <ol className={styles.steps}>
        {STEPS.map((label, index) => (
          <li key={label} className={styles.step} aria-current={index === step ? "step" : undefined} data-complete={index < step || undefined}>
            <span className={styles.stepNumber} aria-hidden="true">{index < step ? <CheckIcon className="size-3.5" strokeWidth={2.5} /> : `0${index + 1}`}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
