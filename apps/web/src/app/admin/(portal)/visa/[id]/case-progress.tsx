import { StatusTimeline } from "@/modules/bookings/components/status-timeline";
import { visaCustomerProgress } from "@/modules/visa/progress";
import type { VisaStage } from "@/modules/visa/workflow";
import type { VisaCase } from "@/modules/visa/case-queries";

export function CaseProgress({ data }: { data: VisaCase }) {
  const progress = visaCustomerProgress({
    status: data.application.status as VisaStage,
    workflow: data.application.workflow,
    memberIds: data.application.members.map(member => member.id),
    documentsComplete: data.readiness.filter(item => ["documents_complete", "documents_reviewed"].includes(item.key)).every(item => item.ok),
    orderStatus: data.paymentState,
    orderId: data.order?.id ?? null,
    orderTotal: null,
    documents: data.application.documents,
    requests: data.application.document_requests,
    appointments: data.appointments,
    passports: data.passports,
    decisionOutcome: (data.currentDecision?.outcome as "approved" | "refused" | undefined) ?? null,
  });
  return <section aria-label="Application progress" className="space-y-4 rounded-xl border border-border bg-card p-5"><h2 className="text-sm font-semibold">{progress.stepLabel}</h2><StatusTimeline stages={progress.stages} currentIndex={progress.index} outcome={progress.outcome} /></section>;
}
