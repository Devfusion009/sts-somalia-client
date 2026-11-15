import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getVisaOrderAdmin, getVisaProcessingWorkspace } from "@/modules/admin/queries";
import { travellerDocumentSlots, documentMemberId, parseRequirementSections, sectionFileSlots } from "./schemas";
import type { PaymentState, ReadinessItem } from "./workflow";
import { parseVisaSort, type VisaQueue, type VisaSort } from "./queues";

const STAFF_DOC_LABELS: Record<string, string> = {
  visa_result: "Issued visa",
  decision_letter: "Decision letter",
  submission_receipt: "Submission receipt",
  passport_authorization: "Collection authorisation",
};

/** Everything the staff case workspace renders, loaded in one round of parallel reads. */
export async function getVisaCase(id: string) {
  const supabase = await createClient();
  const { data: app } = await supabase
    .from("visa_applications")
    .select(
      `*,
       visa_type:visa_type_id (*),
       agency:agency_id (name),
       submitter:profiles!visa_applications_submitted_by_fkey (full_name, email, phone),
       members:visa_members (*),
       documents:visa_documents (*),
       document_requests:visa_document_requests (*)`
    )
    .eq("id", id)
    .neq("status", "draft")
    .maybeSingle();
  if (!app || !app.visa_type) return null;

  const [
    order,
    workspace,
    opsRes,
    readinessRes,
    paymentRes,
    eventsRes,
    appointmentsRes,
    jobsRes,
    decisionsRes,
    passportsRes,
    passportEventsRes,
    centresRes,
    typeCentresRes,
    messagesRes,
  ] = await Promise.all([
    getVisaOrderAdmin(app.id),
    getVisaProcessingWorkspace(app.id, app.visa_type.id),
    supabase
      .from("visa_case_ops")
      .select("*, assignee:profiles!visa_case_ops_assigned_to_fkey (full_name, email)")
      .eq("application_id", app.id)
      .maybeSingle(),
    supabase.rpc("visa_case_readiness", { p_application_id: app.id }),
    supabase.rpc("visa_payment_state", { p_application_id: app.id }),
    supabase.from("visa_case_events").select("*").eq("application_id", app.id).order("created_at", { ascending: false }),
    supabase
      .from("visa_appointments")
      .select("*, centre:visa_application_centres (id, name, city, timezone, address)")
      .eq("application_id", app.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("visa_processing_jobs")
      .select("*, centre:visa_application_centres (id, name, city)")
      .eq("application_id", app.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("visa_decisions")
      .select("*, recorder:profiles!visa_decisions_recorded_by_fkey (full_name)")
      .eq("application_id", app.id)
      .order("recorded_at", { ascending: false }),
    supabase.from("visa_passports").select("*").eq("application_id", app.id).order("created_at"),
    supabase
      .from("visa_passport_events")
      .select("*")
      .eq("application_id", app.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("visa_application_centres")
      .select("id, name, city, country_code, timezone, is_active")
      .eq("is_active", true)
      .order("name"),
    supabase.from("visa_type_centres").select("centre_id").eq("visa_type_id", app.visa_type.id),
    supabase.from("visa_case_messages").select("*").eq("application_id", app.id).order("created_at"),
  ]);

  app.members.sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order);
  app.document_requests.sort((a, b) => a.created_at.localeCompare(b.created_at));

  // Group every version under its slot, newest first; the head is current.
  // Section file fields (admin-defined requirements) can repeat per
  // traveller, so their uploads group by type and traveller.
  const slots = travellerDocumentSlots(app);
  const fileSlots = sectionFileSlots(parseRequirementSections(app.visa_type?.application_sections), app.members);
  const sectionTypes = new Set(fileSlots.map((f) => f.documentType));
  const standardTypes = new Set(slots.map(slot => slot.key));
  const groupKey = (type: string, memberId: string | null) => (memberId || sectionTypes.has(type) || standardTypes.has(type) ? `${type}|${memberId ?? ""}` : type);
  const byType = new Map<string, typeof app.documents>();
  for (const doc of [...app.documents].sort((a, b) => b.version - a.version || b.created_at.localeCompare(a.created_at))) {
    const key = groupKey(doc.document_type, documentMemberId(app, doc));
    const list = byType.get(key) ?? [];
    list.push(doc);
    byType.set(key, list);
  }
  const multipleTravellers = app.members.length > 1;
  const sectionSlots = fileSlots.map((f) => ({
    key: groupKey(f.documentType, f.memberId),
    documentType: f.documentType,
    label: `${f.sectionTitle}: ${f.label}${f.memberName && multipleTravellers ? ` — ${f.memberName}` : ""}`,
    required: f.required,
    staff: false,
    versions: byType.get(groupKey(f.documentType, f.memberId)) ?? [],
  }));
  const knownKeys = new Set([...slots.map((s) => groupKey(s.key, s.memberId)), ...sectionSlots.map((s) => s.key)]);
  const documentSlots = [
    ...slots.map((slot) => ({
      key: groupKey(slot.key, slot.memberId),
      documentType: slot.key,
      label: slot.memberName ? `${slot.memberName} · ${slot.label}` : slot.label,
      required: slot.required,
      staff: false,
      versions: byType.get(groupKey(slot.key, slot.memberId)) ?? [],
    })),
    ...sectionSlots,
    ...[...byType.entries()]
      .filter(([key]) => !knownKeys.has(key))
      .map(([key, versions]) => {
        const type = versions[0]?.document_type ?? key;
        return {
          key,
          documentType: type,
          label: STAFF_DOC_LABELS[type] ?? (type.startsWith("request:") ? type.slice(8) : type.replace(/_/g, " ")),
          required: false,
          staff: type in STAFF_DOC_LABELS,
          versions,
        };
      }),
  ];

  // The standard review checklist for each applicant-uploaded slot.
  const checklistByType = new Map(
    await Promise.all(
      documentSlots
        .filter((slot) => !slot.staff)
        .map(async (slot) => {
          const { data } = await supabase.rpc("visa_document_checklist", { p_document_type: slot.documentType });
          return [slot.key, (data ?? []) as Array<{ key: string; label: string }>] as const;
        })
    )
  );
  const slotsWithChecks = documentSlots.map((slot) => ({ ...slot, checklist: checklistByType.get(slot.key) ?? [] }));

  // Decision chain: the current one is the row nobody supersedes.
  const decisions = decisionsRes.data ?? [];
  const supersededIds = new Set(decisions.map((d) => d.supersedes_id).filter(Boolean));
  const currentDecision = decisions.find((d) => !supersededIds.has(d.id)) ?? null;

  // Centres offered for booking: the visa type's own list, or every active centre when none is configured.
  const typeCentreIds = new Set((typeCentresRes.data ?? []).map((r) => r.centre_id));
  const allCentres = centresRes.data ?? [];
  const centres = typeCentreIds.size > 0 ? allCentres.filter((c) => typeCentreIds.has(c.id)) : allCentres;

  const docById = new Map(app.documents.map((d) => [d.id, d]));

  return {
    application: app,
    order,
    workspace,
    ops: opsRes.data,
    readiness: (readinessRes.data ?? []) as ReadinessItem[],
    paymentState: ((paymentRes.data as string | null) ?? "not_billed") as PaymentState,
    events: eventsRes.data ?? [],
    documentSlots: slotsWithChecks,
    appointments: appointmentsRes.data ?? [],
    jobs: jobsRes.data ?? [],
    activeJob: (jobsRes.data ?? []).find((j) => j.status === "active") ?? null,
    decisions,
    currentDecision,
    passports: passportsRes.data ?? [],
    passportEvents: passportEventsRes.data ?? [],
    centres,
    docById,
    messages: messagesRes.data ?? [],
  };
}

export type VisaCase = NonNullable<Awaited<ReturnType<typeof getVisaCase>>>;

// ---------------------------------------------------------------------------
// Applications console (queues)
// ---------------------------------------------------------------------------

export const QUEUE_PAGE_SIZE = 25;

export type QueueFilters = {
  queue: VisaQueue;
  sort?: VisaSort;
  q?: string;
  destination?: string;
  owner?: string;
  urgent?: boolean;
  page: number;
};

const CLOSED = "(approved,rejected,issued,cancelled)";
const PAID = "(paid,partially_paid)";

export async function getVisaCaseQueue(filters: QueueFilters, meId: string) {
  const supabase = await createClient();
  let query = supabase.from("visa_case_queue").select("*", { count: "exact" });

  switch (filters.queue) {
    case "needs_action":
      query = query.not("attention", "is", null).in("status", ["submitted", "in_review", "additional_info_required", "ready_for_processing"]);
      break;
    case "mine":
      query = query.eq("assigned_to", meId).not("status", "in", CLOSED);
      break;
    case "unassigned":
      query = query.is("assigned_to", null).not("status", "in", CLOSED);
      break;
    case "sla_at_risk":
      query = query
        .lt("sla_due_at", new Date(Date.now() + 24 * 3_600_000).toISOString())
        .in("status", ["submitted", "in_review", "ready_for_processing"])
        .in("payment_state", ["paid", "partially_paid"]);
      break;
    case "payment_pending":
      query = query.eq("status", "submitted").not("payment_state", "in", PAID);
      break;
    case "new":
      query = query.eq("status", "submitted").in("payment_state", ["paid", "partially_paid"]);
      break;
    case "document_review":
      query = query.eq("status", "in_review");
      break;
    case "customer_action":
      query = query.eq("status", "additional_info_required");
      break;
    case "appointment_pending":
      query = query
        .eq("requires_appointment", true)
        .or("appointment_attended.is.null,appointment_attended.eq.false")
        .in("status", ["in_review", "additional_info_required", "ready_for_processing"]);
      break;
    case "ready_for_submission":
      query = query.eq("status", "ready_for_processing");
      break;
    case "processing":
      query = query.eq("status", "processing");
      break;
    case "approved":
      query = query.eq("status", "approved");
      break;
    case "refused":
      query = query.eq("status", "rejected");
      break;
    case "passport_return":
      query = query
        .eq("requires_passport", true)
        .in("status", ["approved", "rejected", "cancelled"])
        .gt("passports_outstanding", 0);
      break;
    case "issued":
      query = query.eq("status", "issued");
      break;
    case "cancelled":
      query = query.eq("status", "cancelled");
      break;
    case "all":
      break;
  }

  const term = filters.q?.trim().toLowerCase().replace(/[%_,()]/g, " ");
  if (term) query = query.ilike("search_text", `%${term}%`);
  if (filters.destination) query = query.eq("destination_country_code", filters.destination);
  if (filters.owner === "none") query = query.is("assigned_to", null);
  else if (filters.owner) query = query.eq("assigned_to", filters.owner);
  if (filters.urgent) query = query.eq("priority", "urgent");

  const from = (filters.page - 1) * QUEUE_PAGE_SIZE;
  const sort = parseVisaSort(filters.sort);
  if (sort === "due") {
    query = query.order("sla_due_at", { ascending: true, nullsFirst: false });
  } else if (sort === "priority") {
    query = query.order("priority", { ascending: false });
  }
  query = query
    .order("submitted_at", { ascending: sort === "oldest", nullsFirst: false })
    .order("created_at", { ascending: sort === "oldest" })
    .order("id", { ascending: sort === "oldest" });

  const { data, count, error } = await query.range(from, from + QUEUE_PAGE_SIZE - 1);
  if (error) throw new Error("Visa applications could not be loaded. Refresh and try again.");
  return { rows: data ?? [], total: count ?? 0 };
}

export type QueueRow = Awaited<ReturnType<typeof getVisaCaseQueue>>["rows"][number];

export async function getVisaQueueCounts() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("visa_queue_counts");
  if (error) throw new Error("Visa queue counts are unavailable.");
  return (data ?? {}) as Record<string, number>;
}

/** Staff who can own a case (assignment picker). */
export async function getVisaStaff() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_platform_admin", true)
    .order("full_name");
  return data ?? [];
}

/** Destinations present in the queue, for the filter. */
export async function getVisaQueueDestinations() {
  const supabase = await createClient();
  const { data } = await supabase.from("visa_types").select("destination_country_code");
  return [...new Set((data ?? []).map((r) => r.destination_country_code))].sort();
}

/** Booked appointments from today on (plus overdue ones still without an outcome). */
export async function getUpcomingVisaAppointments(centreId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("visa_appointments")
    .select(
      `*,
       centre:visa_application_centres (id, name, city, timezone),
       application:visa_applications (id, application_ref, traveler_details, visa_type:visa_type_id (name, destination_country_code))`
    )
    .eq("status", "booked")
    .order("scheduled_at");
  if (centreId) query = query.eq("centre_id", centreId);
  const { data } = await query.limit(300);
  return data ?? [];
}

export type AppointmentHandoff = { id: string; application_ref: string; applicant_name: string | null; visa_name: string; destination_country_code: string; booked: boolean };
export async function getAppointmentHandoffs(page = 1) {
  const db = await createClient();
  const { data, error } = await (db as unknown as import("@supabase/supabase-js").SupabaseClient).rpc("admin_visa_appointment_handoffs", { p_offset: (page - 1) * 20, p_limit: 20 });
  if (error) throw new Error("Appointment handoffs are unavailable. Refresh and try again.");
  return data as { count: number; rows: AppointmentHandoff[] };
}
