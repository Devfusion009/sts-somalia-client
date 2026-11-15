/** Payment acknowledgement is separate from a staff document decision. */
export function visaReviewHandoff(stage: string | null | undefined, payment: string | null | undefined) {
  if (!["submitted", "in_review"].includes(stage ?? "") || !["paid", "partially_paid"].includes(payment ?? "")) return null;
  return {
    message: payment === "partially_paid" ? "Deposit received · Ready for document review" : "Payment received · Ready for document review",
    label: "Review documents",
    tab: "documents" as const,
  };
}
