import {
  CalendarCheck,
  FileCheck2,
  Gavel,
  Landmark,
  PackageCheck,
  Send,
  Stamp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { readWorkflow, type VisaStage } from "./workflow";

/**
 * The applicant's view of a case: up to eight plain steps and one next
 * action. Derived only from what the applicant is allowed to read (RLS), so
 * no staff-only detail (owner, SLA, internal notes, lodgement job) leaks in.
 */

export type ProgressInput = {
  status: VisaStage;
  workflow: unknown;
  orderStatus: string | null;
  orderId: string | null;
  orderTotal: string | null;
  documents: Array<{ id: string; document_type: string; is_current: boolean; review_status: string; rejection_reason: string | null }>;
  requests: Array<{ id: string; title: string; status: string; requirement: string; due_date: string | null; description: string | null }>;
  appointments: Array<{
    id: string;
    status: string;
    appointment_type: string;
    scheduled_at: string;
    confirmation_number: string | null;
    biometrics_required: boolean;
    centre: { name: string; city: string; address: string | null; timezone: string; collection_hours?: string | null } | null;
  }>;
  passports: Array<{ id: string; status: string; holder_name: string | null; tracking_reference: string | null }>;
  decisionOutcome: "approved" | "refused" | null;
};

export type ProgressStep = { key: string; label: string; description?: string; icon: LucideIcon };

const PAID = new Set(["paid", "partially_paid", "processing", "completed"]);
const STAGE_ORDER: VisaStage[] = [
  "draft",
  "submitted",
  "in_review",
  "additional_info_required",
  "ready_for_processing",
  "processing",
  "approved",
  "issued",
];

function reached(status: VisaStage, target: VisaStage) {
  return STAGE_ORDER.indexOf(status) >= STAGE_ORDER.indexOf(target);
}

export function visaCustomerProgress(input: ProgressInput) {
  const workflow = readWorkflow(input.workflow);
  const paid = input.orderStatus ? PAID.has(input.orderStatus) : false;
  const refused = input.status === "rejected";
  const cancelled = input.status === "cancelled";
  const decided = input.decisionOutcome !== null || ["approved", "issued", "rejected"].includes(input.status);
  const attended = input.appointments.some((a) => a.status === "attended");
  const passportsBack =
    input.passports.length > 0 && input.passports.every((p) => ["delivered", "collected"].includes(p.status));

  const steps: Array<ProgressStep & { done: boolean }> = [
    { key: "application", label: "Application", icon: FileCheck2, done: input.status !== "draft" },
    { key: "payment", label: "Payment", icon: Wallet, done: paid || decided },
    {
      key: "documents",
      label: "Documents",
      icon: Stamp,
      done: decided || reached(input.status, "ready_for_processing") && input.status !== "additional_info_required",
    },
  ];
  if (workflow.requires_appointment) {
    steps.push({ key: "appointment", label: "Appointment", icon: CalendarCheck, done: attended || decided });
  }
  steps.push(
    { key: "submission", label: "Submission", icon: Send, done: decided || input.status === "processing" },
    { key: "processing", label: "Processing", icon: Landmark, done: decided },
    {
      key: "decision",
      label: refused ? "Refused" : "Decision",
      icon: Gavel,
      done: decided,
      description: refused ? "Refused" : input.status === "approved" || input.status === "issued" ? "Approved" : undefined,
    }
  );
  if (workflow.requires_physical_passport) {
    steps.push({ key: "passport", label: "Passport", icon: PackageCheck, done: passportsBack || input.status === "issued" });
  }

  let index = steps.findIndex((s) => !s.done);
  if (index === -1) index = steps.length - 1;

  const last = steps.length - 1;
  const outcome: "pending" | "success" | "failed" =
    cancelled
      ? "failed"
      : refused && steps[last].key === "decision"
        ? "failed"
        : index === last && steps[last].done && !refused
          ? "success"
          : "pending";

  return {
    stages: steps.map((step) => ({ key: step.key, label: step.label, description: step.description, icon: step.icon })),
    index,
    outcome,
    stepLabel: `Step ${Math.min(index + 1, steps.length)} of ${steps.length} · ${steps[index].label}`,
  };
}

export type NextAction =
  | { kind: "pay"; href: string; amount: string | null }
  | { kind: "upload"; items: Array<{ label: string; reason: string | null; due: string | null }> }
  | { kind: "handover" }
  | { kind: "attend"; appointment: ProgressInput["appointments"][number] }
  | { kind: "collect"; passports: ProgressInput["passports"]; hours: string | null }
  | { kind: "download"; documentId: string }
  | { kind: "none" };

export function visaNextAction(input: ProgressInput, labelFor: (documentType: string) => string): NextAction {
  const workflow = readWorkflow(input.workflow);
  if (input.status === "cancelled") return { kind: "none" };

  if (input.status === "submitted" && input.orderId && input.orderStatus && !PAID.has(input.orderStatus)) {
    return { kind: "pay", href: `/checkout/${input.orderId}`, amount: input.orderTotal };
  }

  const rejected = input.documents.filter((d) => d.is_current && d.review_status === "rejected");
  const openRequests = input.requests.filter((r) => r.status === "requested" && r.requirement === "required");
  if (rejected.length > 0 || openRequests.length > 0) {
    return {
      kind: "upload",
      items: [
        ...rejected.map((d) => ({ label: labelFor(d.document_type), reason: d.rejection_reason, due: null })),
        ...openRequests.map((r) => ({ label: r.title, reason: r.description, due: r.due_date })),
      ],
    };
  }

  const booked = input.appointments
    .filter((a) => a.status === "booked")
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  if (booked) return { kind: "attend", appointment: booked };

  if (
    workflow.requires_physical_passport &&
    ["in_review", "additional_info_required", "ready_for_processing"].includes(input.status) &&
    input.passports.some((p) => p.status === "with_applicant")
  ) {
    return { kind: "handover" };
  }

  const ready = input.passports.filter((p) => p.status === "ready_for_collection");
  if (ready.length > 0) {
    return { kind: "collect", passports: ready, hours: input.appointments.find((a) => a.centre?.collection_hours)?.centre?.collection_hours ?? null };
  }

  const result = input.documents.find((d) => d.document_type === "visa_result" && d.is_current);
  if (result && (input.status === "approved" || input.status === "issued")) {
    return { kind: "download", documentId: result.id };
  }

  return { kind: "none" };
}
