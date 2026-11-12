"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { AGENT_BOOKING_STEPS, getAgentService } from "@/modules/agencies/services";
import styles from "./booking-desk.module.css";

function currentStep(pathname: string, serviceSelected: boolean) {
  const segments = pathname.split("/").filter(Boolean);
  const rest = segments.slice(segments.indexOf("book") + 1).join("/");
  if (rest.startsWith("order/") || rest.startsWith("batch/")) return 3;
  if (rest) return 2;
  return serviceSelected ? 1 : 0;
}

export function DeskSteps() {
  const pathname = usePathname();
  const service = getAgentService(useSearchParams().get("service"));
  const step = currentStep(pathname, Boolean(service));
  const steps = [...AGENT_BOOKING_STEPS] as string[];
  if (service?.key === "flights" || /(?:^|\/)book\/flights(?:\/|$)/.test(pathname)) steps[3] = "Request quote";
  if (/(?:^|\/)book\/umrah\/private(?:\/|$)/.test(pathname)) steps[3] = "Review request";
  return (
    <nav aria-label="Booking steps">
      <div className={styles.progressHead}><span>Booking progress</span><span>Step {step + 1} of {steps.length}</span></div>
      <ol className={styles.steps}>
        {steps.map((label, index) => (
          <li key={label} className={styles.step} aria-current={index === step ? "step" : undefined} data-complete={index < step || undefined}>
            <span className={styles.stepNumber} aria-hidden="true">{index < step ? <CheckIcon className="size-3.5" strokeWidth={2.5} /> : `0${index + 1}`}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
