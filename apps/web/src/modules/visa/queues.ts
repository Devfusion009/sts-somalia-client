/**
 * Work queues for the visa console (spec §33 / §60). Each queue answers one
 * operational question; counts come from visa_queue_counts() and rows from
 * the visa_case_queue view — both defined in
 * supabase/migrations/20260928000010_visa_case_queue.sql. Keep the filters
 * here in step with the FILTER clauses there.
 */
export const VISA_QUEUE_GROUPS = [
  {
    label: "My work",
    queues: [
      { key: "needs_action", label: "Needs action" },
      { key: "mine", label: "Assigned to me" },
      { key: "unassigned", label: "Unassigned" },
      { key: "sla_at_risk", label: "Due within 24h" },
    ],
  },
  {
    label: "In progress",
    queues: [
      { key: "payment_pending", label: "Awaiting payment" },
      { key: "new", label: "New" },
      { key: "document_review", label: "Document review" },
      { key: "customer_action", label: "Waiting on applicant" },
      { key: "appointment_pending", label: "Appointment pending" },
      { key: "ready_for_submission", label: "Ready for submission" },
      { key: "processing", label: "Processing" },
    ],
  },
  {
    label: "Closed",
    queues: [
      { key: "approved", label: "Approved" },
      { key: "passport_return", label: "Passport return" },
      { key: "refused", label: "Refused" },
      { key: "issued", label: "Issued" },
      { key: "cancelled", label: "Cancelled" },
      { key: "all", label: "All" },
    ],
  },
] as const;

export type VisaQueue = (typeof VISA_QUEUE_GROUPS)[number]["queues"][number]["key"];

const QUEUE_KEYS = new Set<string>(VISA_QUEUE_GROUPS.flatMap((g) => g.queues.map((q) => q.key)));

export function isVisaQueue(value: string | undefined): value is VisaQueue {
  return !!value && QUEUE_KEYS.has(value);
}

export const VISA_QUEUE_LABELS: Record<string, string> = Object.fromEntries(
  VISA_QUEUE_GROUPS.flatMap((g) => g.queues.map((q) => [q.key, q.label]))
);

export const ATTENTION_LABELS: Record<string, string> = {
  new: "Start review",
  review: "Review documents",
  customer_replied: "Applicant replied",
  ready: "Submit to centre",
  appointment_outcome: "Record appointment",
  deliver: "Deliver visa",
  message: "Reply to applicant",
};

export const OPEN_STAGES = [
  "submitted",
  "in_review",
  "additional_info_required",
  "ready_for_processing",
  "processing",
] as const;
