import type { Database } from "@/lib/types/database.types";
import { type VisaPermission } from "./permissions";

/**
 * Case-stage model shared by the admin console. Mirrors _visa_set_stage() in
 * supabase/migrations/20260928000005_visa_stage_actions.sql — the SQL is what
 * enforces it; this decides which buttons to offer.
 */
export type VisaStage = Database["public"]["Enums"]["visa_status"];

/** Staff-facing stage names (visa_stage_label() in SQL). */
export const VISA_STAGE_LABELS: Record<VisaStage, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_review: "Document review",
  additional_info_required: "Action required",
  ready_for_processing: "Ready for submission",
  processing: "Submitted / processing",
  approved: "Approved",
  rejected: "Refused",
  issued: "Visa issued",
  cancelled: "Cancelled",
};

export const CLOSED_STAGES: VisaStage[] = ["approved", "rejected", "issued", "cancelled"];

export type VisaWorkflow = {
  requires_appointment: boolean;
  requires_biometrics: boolean;
  requires_physical_passport: boolean;
  passport_delivery_modes: string[];
  internal_sla_days: number;
};

/** Snapshot taken at submit; missing keys (pre-snapshot cases) read as "not required". */
export function readWorkflow(raw: unknown): VisaWorkflow {
  const w = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    requires_appointment: w.requires_appointment === true,
    requires_biometrics: w.requires_biometrics === true,
    requires_physical_passport: w.requires_physical_passport === true,
    passport_delivery_modes: Array.isArray(w.passport_delivery_modes)
      ? w.passport_delivery_modes.map(String)
      : ["counter"],
    internal_sla_days: typeof w.internal_sla_days === "number" ? w.internal_sla_days : 2,
  };
}

export type PaymentState = "not_billed" | "pending" | "partially_paid" | "paid" | "cancelled" | "refunded";

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  not_billed: "Not billed",
  pending: "Awaiting payment",
  partially_paid: "Part paid",
  paid: "Paid",
  cancelled: "Order cancelled",
  refunded: "Refunded",
};

export type ReadinessItem = {
  key: string;
  label: string;
  applies: boolean;
  ok: boolean;
  detail: string | null;
};

export type VisaCaseContext = {
  stage: VisaStage;
  paymentState: PaymentState;
  infoReturnStage: VisaStage | null;
  readiness: ReadinessItem[];
  workflow: VisaWorkflow;
  hasResultDocument: boolean;
  hasBookedAppointment: boolean;
};

export type VisaActionKey =
  | "start_review"
  | "request_document"
  | "resume"
  | "mark_ready"
  | "cancel"
  | "book_appointment"
  | "record_submission"
  | "record_decision"
  | "attach_visa"
  | "return_passports";

export type VisaAction = {
  key: VisaActionKey;
  label: string;
  permission: VisaPermission;
  tone: "primary" | "secondary" | "destructive";
  disabledReason?: string;
  /** Opens the tab where the action's form lives. */
  tab?: string;
};

function isPaid(state: PaymentState) {
  return state === "paid" || state === "partially_paid";
}

/**
 * The actions a staff member can take on a case right now. Derived from the
 * stage plus readiness, then filtered by permission — never a free status
 * picker. Actions with a `tab` open the tab holding their form.
 */
export function visaAvailableActions(ctx: VisaCaseContext, can: (perm: VisaPermission) => boolean): VisaAction[] {
  const actions: VisaAction[] = [];
  const readiness = new Map(ctx.readiness.map((r) => [r.key, r]));
  const unpaid = isPaid(ctx.paymentState) ? undefined : "Awaiting payment";

  switch (ctx.stage) {
    case "submitted":
      actions.push({
        key: "start_review",
        label: "Start review",
        permission: "visa.documents.review",
        tone: "primary",
        disabledReason: unpaid,
      });
      actions.push({
        key: "request_document",
        label: "Request document",
        permission: "visa.documents.request",
        tone: "secondary",
        disabledReason: unpaid,
      });
      break;
    case "in_review": {
      const docs = readiness.get("documents_reviewed");
      actions.push({
        key: "mark_ready",
        label: "Mark ready for submission",
        permission: "visa.documents.review",
        tone: "primary",
        disabledReason: docs && !docs.ok ? docs.detail ?? "Documents outstanding" : undefined,
      });
      actions.push({
        key: "request_document",
        label: "Request document",
        permission: "visa.documents.request",
        tone: "secondary",
      });
      break;
    }
    case "additional_info_required": {
      const docs = readiness.get("documents_complete");
      actions.push({
        key: "resume",
        label: ctx.infoReturnStage === "processing" ? "Resume processing" : "Resume review",
        permission: "visa.documents.review",
        tone: "primary",
        disabledReason: docs && !docs.ok ? docs.detail ?? "Waiting on the applicant" : undefined,
      });
      actions.push({
        key: "request_document",
        label: "Request document",
        permission: "visa.documents.request",
        tone: "secondary",
      });
      break;
    }
    case "ready_for_processing": {
      const blocker = ["appointment", "biometrics", "passport"]
        .map((k) => readiness.get(k))
        .find((r) => r && r.applies && !r.ok);
      actions.push({
        key: "record_submission",
        label: "Record submission",
        permission: "visa.submission.record",
        tone: "primary",
        tab: "submission",
        disabledReason: blocker ? `${blocker.label} outstanding` : undefined,
      });
      actions.push({
        key: "request_document",
        label: "Request document",
        permission: "visa.documents.request",
        tone: "secondary",
      });
      break;
    }
    case "processing":
      actions.push({
        key: "record_decision",
        label: "Record decision",
        permission: "visa.decision.record",
        tone: "primary",
        tab: "decision",
      });
      actions.push({
        key: "request_document",
        label: "Request document",
        permission: "visa.documents.request",
        tone: "secondary",
      });
      break;
    case "approved":
      if (ctx.workflow.requires_physical_passport) {
        actions.push({
          key: "return_passports",
          label: "Return passports",
          permission: "visa.passport.manage",
          tone: "primary",
          tab: "passport",
        });
      } else if (!ctx.hasResultDocument) {
        actions.push({
          key: "attach_visa",
          label: "Attach issued visa",
          permission: "visa.decision.record",
          tone: "primary",
          tab: "decision",
        });
      }
      break;
    default:
      break;
  }

  const appointment = readiness.get("appointment");
  if (
    ctx.workflow.requires_appointment &&
    ["in_review", "additional_info_required", "ready_for_processing"].includes(ctx.stage) &&
    appointment &&
    !appointment.ok &&
    !ctx.hasBookedAppointment
  ) {
    actions.splice(ctx.stage === "ready_for_processing" ? 0 : 1, 0, {
      key: "book_appointment",
      label: "Book appointment",
      permission: "visa.appointments.manage",
      tone: ctx.stage === "ready_for_processing" ? "primary" : "secondary",
      tab: "appointments",
      disabledReason: isPaid(ctx.paymentState) ? undefined : "Awaiting payment",
    });
  }

  if (!CLOSED_STAGES.includes(ctx.stage) && ctx.stage !== "draft") {
    actions.push({ key: "cancel", label: "Cancel case", permission: "visa.case.cancel", tone: "destructive" });
  }

  return actions.filter((a) => can(a.permission));
}

/** Days since a timestamp, floored; null-safe. */
export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/** True when the timestamp is already behind us. */
export function isPast(iso: string | null | undefined): boolean {
  return !!iso && new Date(iso).getTime() < Date.now();
}

export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  submission: "Submission",
  biometrics: "Biometrics",
  interview: "Interview",
  collection: "Passport collection",
};

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  booked: "Booked",
  attended: "Attended",
  no_show: "No-show",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

export const PROCESSING_STAGE_LABELS: Record<string, string> = {
  in_centre: "At the visa centre",
  in_authority: "With the authority",
  awaiting_decision: "Awaiting decision",
};

export const CENTRE_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  accepted: "Accepted by centre",
  returned_for_correction: "Returned for correction",
};

export const PASSPORT_STATUS_LABELS: Record<string, string> = {
  with_applicant: "With applicant",
  with_sts: "With STS",
  with_centre: "With centre",
  in_transit: "In transit",
  ready_for_collection: "Ready for collection",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  collected: "Collected",
};

/** Mirrors the transition map in visa_record_passport_event(). */
export const PASSPORT_NEXT: Record<string, string[]> = {
  with_applicant: ["with_sts", "with_centre"],
  with_sts: ["with_centre", "ready_for_collection", "with_applicant"],
  with_centre: ["in_transit", "ready_for_collection", "with_sts"],
  in_transit: ["with_sts", "ready_for_collection"],
  ready_for_collection: ["collected", "out_for_delivery"],
  out_for_delivery: ["delivered", "ready_for_collection"],
  delivered: [],
  collected: [],
};

export const DELIVERY_MODE_LABELS: Record<string, string> = {
  counter: "Counter collection",
  courier: "Courier",
  third_party: "Authorised third party",
};

/** True when the timestamp is at most `hours` from now (or already past). */
export function isDueWithin(iso: string, hours: number): boolean {
  return new Date(iso).getTime() <= Date.now() + hours * 3_600_000;
}
