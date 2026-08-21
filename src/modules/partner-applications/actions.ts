"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { APP_CONFIG, REJECT_COOLDOWN_DAYS, docSlotsFor, type ApplicationKind } from "./config";
import { getEditableApplication, getLatestApplication, type DocumentRef } from "./queries";

export type ActionState = { error: string | null } | null;

/** "+<dial code><6-10 digit local number>", produced by PhoneField. */
const phoneSchema = z.string().regex(/^\+\d{1,4}\d{6,10}$/, "Enter a valid phone number.");

function wizardPath(kind: ApplicationKind, id: string, step: number) {
  return `/account/become/${kind}/${id}?step=${step}`;
}

function kindOf(formData: FormData): ApplicationKind {
  const v = formData.get("kind");
  if (v === "agency" || v === "hotel_partner" || v === "affiliate" || v === "venue_partner") return v;
  throw new Error("Invalid application kind.");
}

/** Merge new keys into business_details jsonb without clobbering keys other steps wrote. */
function mergeDetails(existing: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const base = existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {};
  return { ...base, ...patch };
}

// ---------------------------------------------------------------------------
// Start / resume
// ---------------------------------------------------------------------------
export async function startApplication(formData: FormData): Promise<void> {
  const kind = kindOf(formData);
  const cfg = APP_CONFIG[kind];
  const user = await requireUser();
  const supabase = await createClient();

  const latest = await getLatestApplication(kind, user.id);

  if (latest && (latest.status === "draft" || latest.status === "more_info_requested")) {
    redirect(wizardPath(kind, latest.id, 1));
  }

  if (latest && latest.status === "rejected" && latest.reviewed_at) {
    const cooldownEnds = new Date(latest.reviewed_at).getTime() + REJECT_COOLDOWN_DAYS * 86_400_000;
    if (Date.now() < cooldownEnds) {
      redirect("/account/become?cooldown=1");
    }
  }

  const insertRow: Record<string, unknown> = {
    applicant_id: user.id,
    status: "draft",
    business_details: {},
    document_refs: [],
  };
  if (cfg.nameField) insertRow[cfg.nameField] = "";

  const { data: created, error } = await supabase.from(cfg.table).insert(insertRow as never).select("id").single();
  if (error || !created) redirect("/account/become?error=1");

  redirect(wizardPath(kind, created.id, 1));
}

// ---------------------------------------------------------------------------
// Step 1 — business details (agency / hotel_partner) or "about you" (affiliate)
// ---------------------------------------------------------------------------
const step1BusinessSchema = z.object({
  legalBusinessName: z.string().min(2, "Enter your legal business name."),
  tradingName: z.string().optional(),
  businessType: z.string().min(1, "Select a business type."),
  yearEstablished: z.string().optional(),
  registrationNumber: z.string().optional(),
  taxId: z.string().optional(),
  officeStreet: z.string().optional(),
  officeCity: z.string().min(1, "Enter the city."),
  officeRegion: z.string().optional(),
  businessPhone: phoneSchema,
  businessEmail: z.string().email("Enter a valid business email."),
  website: z.string().optional(),
  branchesJson: z.string().optional(),
});

// An affiliate is an individual referring an existing B2C platform, not a
// registered business — no legal name/tax ID/office address, just who they
// are, how to reach them, and where their audience actually is.
const step1AffiliateSchema = z.object({
  fullName: z.string().min(2, "Enter your full name."),
  city: z.string().min(1, "Enter your city."),
  audienceLocation: z.string().min(1, "Select where your audience is mainly based."),
  mobile: phoneSchema,
  email: z.string().email("Enter a valid email."),
});

export async function saveStep1(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = kindOf(formData);
  const id = String(formData.get("applicationId"));

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(kind, id, user.id);
  if (!application) return { error: "This application can no longer be edited." };

  const cfg = APP_CONFIG[kind];
  const currentStep = Number((application.business_details as Record<string, unknown> | null)?._wizard_step) || 1;
  const update: Record<string, unknown> = {};

  if (kind === "affiliate") {
    const parsed = step1AffiliateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    update.business_details = mergeDetails(application.business_details, {
      fullName: parsed.data.fullName,
      city: parsed.data.city,
      audienceLocation: parsed.data.audienceLocation,
      mobile: parsed.data.mobile,
      email: parsed.data.email,
      _wizard_step: Math.max(2, currentStep),
    });
  } else {
    const parsed = step1BusinessSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    let branches: Array<{ name: string; location: string }> = [];
    try {
      branches = parsed.data.branchesJson ? JSON.parse(parsed.data.branchesJson) : [];
    } catch {
      branches = [];
    }
    update.business_details = mergeDetails(application.business_details, {
      legalBusinessName: parsed.data.legalBusinessName,
      tradingName: parsed.data.tradingName || null,
      businessType: parsed.data.businessType,
      yearEstablished: parsed.data.yearEstablished || null,
      registrationNumber: parsed.data.registrationNumber || null,
      taxId: parsed.data.taxId || null,
      officeStreet: parsed.data.officeStreet || null,
      officeCity: parsed.data.officeCity,
      officeRegion: parsed.data.officeRegion || null,
      businessPhone: parsed.data.businessPhone,
      businessEmail: parsed.data.businessEmail,
      website: parsed.data.website || null,
      branches,
      _wizard_step: Math.max(2, currentStep),
    });
    if (cfg.nameField) update[cfg.nameField] = parsed.data.legalBusinessName;
  }

  const { error } = await supabase.from(cfg.table).update(update as never).eq("id", id);
  if (error) return { error: error.message };

  if (formData.get("intent") === "continue") redirect(wizardPath(kind, id, 2));
  return { error: null };
}

// ---------------------------------------------------------------------------
// Step 2 — authorized contact (agency / hotel_partner) or identity verification (affiliate)
// ---------------------------------------------------------------------------
const step2ContactSchema = z.object({
  contactFullName: z.string().min(2, "Enter the contact's full name."),
  contactRole: z.string().min(1, "Enter their role or title."),
  contactIdNumber: z.string().min(3, "Enter a national ID or passport number."),
  contactMobile: phoneSchema,
  contactEmail: z.string().email("Enter a valid email."),
});

// The affiliate already gave their name/phone/email in step 1 — step 2 here
// exists purely to record the ID number backing the document they'll upload
// in the Documents step, for payout fraud prevention.
const step2AffiliateSchema = z.object({
  idNumber: z.string().min(3, "Enter a national ID or passport number."),
});

export async function saveStep2(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = kindOf(formData);
  const id = String(formData.get("applicationId"));

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(kind, id, user.id);
  if (!application) return { error: "This application can no longer be edited." };

  const step = Math.max(3, Number((application.business_details as Record<string, unknown> | null)?._wizard_step) || 1);
  let details: Record<string, unknown>;

  if (kind === "affiliate") {
    const parsed = step2AffiliateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    details = mergeDetails(application.business_details, { idNumber: parsed.data.idNumber, _wizard_step: step });
  } else {
    const parsed = step2ContactSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    details = mergeDetails(application.business_details, {
      contactFullName: parsed.data.contactFullName,
      contactRole: parsed.data.contactRole,
      contactIdNumber: parsed.data.contactIdNumber,
      contactMobile: parsed.data.contactMobile,
      contactEmail: parsed.data.contactEmail,
      _wizard_step: step,
    });
  }

  const { error } = await supabase.from(APP_CONFIG[kind].table).update({ business_details: details } as never).eq("id", id);
  if (error) return { error: error.message };

  if (formData.get("intent") === "continue") redirect(wizardPath(kind, id, 3));
  return { error: null };
}

// ---------------------------------------------------------------------------
// Step 3 — type-specific operations
// ---------------------------------------------------------------------------
const step3AgencySchema = z.object({
  yearsExperience: z.string().optional(),
  staffCount: z.string().optional(),
  monthlyVolume: z.string().min(1, "Select an estimated monthly volume."),
  products: z.string().optional(), // comma-separated
  iataNumber: z.string().optional(),
});

const step3HotelSchema = z.object({
  propertyType: z.string().min(1, "Select a property type."),
  propertyName: z.string().min(2, "Enter the property name."),
  starRating: z.string().min(1, "Select a star rating."),
  propertyStreet: z.string().optional(),
  location: z.string().min(2, "Enter the property's location/city."),
  totalRooms: z.string().min(1, "Enter the total number of rooms."),
  roomTypesJson: z.string().optional(),
  checkInTime: z.string().min(1, "Set a check-in time."),
  checkOutTime: z.string().min(1, "Set a check-out time."),
  amenities: z.string().optional(), // comma-separated
  cancellationPolicy: z.string().min(1, "Select a cancellation policy."),
});

const step3AffiliateSchema = z.object({
  handlesJson: z.string().optional(),
  audienceSize: z.string().optional(),
  trafficSource: z.string().min(1, "Select your primary traffic source."),
  promotionPlan: z.string().min(10, "Tell us a bit about how you'll promote STS Somalia."),
});

// Venue application captures the flagship hall's shape — actual venue
// listings (with photos, live pricing) are created in the Venue Portal after
// approval, same split as hotel_partner's property step vs the portal.
const step3VenueSchema = z.object({
  venueName: z.string().min(2, "Enter the venue name."),
  location: z.string().min(2, "Enter the venue's location/city."),
  seatedCapacity: z.string().optional(),
  standingCapacity: z.string().min(1, "Enter the standing capacity."),
  eventTypes: z.string().optional(), // comma-separated
  indicativePrice: z.string().optional(),
});

export async function saveStep3(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = kindOf(formData);
  const id = String(formData.get("applicationId"));
  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(kind, id, user.id);
  if (!application) return { error: "This application can no longer be edited." };

  const currentStep = Number((application.business_details as Record<string, unknown> | null)?._wizard_step) || 1;
  const nextStep = APP_CONFIG[kind].hasSettlementStep ? 4 : 5;
  let patch: Record<string, unknown> = {};

  if (kind === "agency") {
    const parsed = step3AgencySchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    patch = {
      yearsExperience: parsed.data.yearsExperience || null,
      staffCount: parsed.data.staffCount || null,
      monthlyVolume: parsed.data.monthlyVolume,
      products: parsed.data.products ? parsed.data.products.split(",").filter(Boolean) : [],
      iataNumber: parsed.data.iataNumber || null,
    };
  } else if (kind === "hotel_partner") {
    const parsed = step3HotelSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    let roomTypes: Array<{ typeName: string; count: string; maxOccupancy: string; basePriceUsd: string }> = [];
    try {
      roomTypes = parsed.data.roomTypesJson ? JSON.parse(parsed.data.roomTypesJson) : [];
    } catch {
      roomTypes = [];
    }
    roomTypes = roomTypes.filter((r) => r.typeName?.trim());
    if (roomTypes.length === 0) return { error: "Add at least one room type (e.g. Standard Double, Deluxe Suite)." };
    patch = {
      propertyType: parsed.data.propertyType,
      propertyName: parsed.data.propertyName,
      starRating: parsed.data.starRating,
      propertyStreet: parsed.data.propertyStreet || null,
      location: parsed.data.location,
      totalRooms: parsed.data.totalRooms,
      roomTypes,
      checkInTime: parsed.data.checkInTime,
      checkOutTime: parsed.data.checkOutTime,
      amenities: parsed.data.amenities ? parsed.data.amenities.split(",").filter(Boolean) : [],
      cancellationPolicy: parsed.data.cancellationPolicy,
    };
  } else if (kind === "venue_partner") {
    const parsed = step3VenueSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    patch = {
      venueName: parsed.data.venueName,
      location: parsed.data.location,
      seatedCapacity: parsed.data.seatedCapacity || null,
      standingCapacity: parsed.data.standingCapacity,
      eventTypes: parsed.data.eventTypes ? parsed.data.eventTypes.split(",").filter(Boolean) : [],
      indicativePrice: parsed.data.indicativePrice || null,
    };
  } else {
    const parsed = step3AffiliateSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    let handles: Array<{ platform: string; handle: string }> = [];
    try {
      handles = parsed.data.handlesJson ? JSON.parse(parsed.data.handlesJson) : [];
    } catch {
      handles = [];
    }
    patch = {
      handles,
      audienceSize: parsed.data.audienceSize || null,
      trafficSource: parsed.data.trafficSource,
      promotionPlan: parsed.data.promotionPlan,
    };
  }

  const details = mergeDetails(application.business_details, {
    ...patch,
    _wizard_step: Math.max(nextStep, currentStep),
  });

  const { error } = await supabase.from(APP_CONFIG[kind].table).update({ business_details: details } as never).eq("id", id);
  if (error) return { error: error.message };

  if (formData.get("intent") === "continue") redirect(wizardPath(kind, id, nextStep));
  return { error: null };
}

// ---------------------------------------------------------------------------
// Step 4 — settlement (agency + hotel_partner only)
// ---------------------------------------------------------------------------
const step4AgencySchema = z.object({
  paymentModel: z.enum(["prepaid_wallet", "credit_line"]),
  estimatedMonthlyVolume: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
});

// A hotel is a supplier, not a buyer: it never taps a wallet/credit line, it
// gets PAID OUT for completed stays, so bank details are mandatory here
// (they're optional for an agency, whose primary settlement method is the
// wallet/credit line above) and the only choice to make is payout cadence.
const step4HotelSchema = z.object({
  payoutFrequency: z.string().min(1, "Select a payout frequency."),
  bankName: z.string().min(2, "Enter the bank name."),
  bankAccountName: z.string().min(2, "Enter the account holder name."),
  bankAccountNumber: z.string().min(4, "Enter the account number."),
});

export async function saveStep4(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = kindOf(formData);
  const id = String(formData.get("applicationId"));

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(kind, id, user.id);
  if (!application) return { error: "This application can no longer be edited." };

  let patch: Record<string, unknown>;
  // Venue partners are suppliers exactly like hotels — paid out for completed
  // events — so they share the payout-cadence + mandatory-bank settlement.
  if (kind === "hotel_partner" || kind === "venue_partner") {
    const parsed = step4HotelSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    patch = {
      payoutFrequency: parsed.data.payoutFrequency,
      bankName: parsed.data.bankName,
      bankAccountName: parsed.data.bankAccountName,
      bankAccountNumber: parsed.data.bankAccountNumber,
    };
  } else {
    const parsed = step4AgencySchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    patch = {
      paymentModel: parsed.data.paymentModel,
      estimatedMonthlyVolume: parsed.data.estimatedMonthlyVolume || null,
      bankName: parsed.data.bankName || null,
      bankAccountName: parsed.data.bankAccountName || null,
      bankAccountNumber: parsed.data.bankAccountNumber || null,
    };
  }

  const currentStep = Number((application.business_details as Record<string, unknown> | null)?._wizard_step) || 1;
  const details = mergeDetails(application.business_details, {
    ...patch,
    _wizard_step: Math.max(5, currentStep),
  });

  const { error } = await supabase.from(APP_CONFIG[kind].table).update({ business_details: details } as never).eq("id", id);
  if (error) return { error: error.message };

  if (formData.get("intent") === "continue") redirect(wizardPath(kind, id, 5));
  return { error: null };
}

// ---------------------------------------------------------------------------
// Step 5 — documents
// ---------------------------------------------------------------------------
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

/** `<input type="date">` permits extended-year values (e.g. a stray keystroke producing "12028-08-20") that are valid per spec but nonsense for a document expiry. */
function isValidExpiry(value: string | null): boolean {
  if (value === null) return true;
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  return year >= 1900 && year <= 2100;
}

export async function uploadApplicationDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = kindOf(formData);
  const id = String(formData.get("applicationId"));
  const docKey = String(formData.get("docKey") || "");
  const docLabel = String(formData.get("docLabel") || docKey);
  const file = formData.get("file");
  const expiry = String(formData.get("expiry") || "") || null;

  if (!docKey) return { error: "Unknown document type." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (!ALLOWED_TYPES.includes(file.type)) return { error: "Only JPG, PNG, or PDF files are accepted." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "File must be 5MB or smaller." };
  if (!isValidExpiry(expiry)) return { error: "Enter a valid expiry date." };

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(kind, id, user.id);
  if (!application) return { error: "This application can no longer be edited." };

  // kyc-documents/{application_type}/{application_id}/{doc_key}/{filename} —
  // every document type gets its own folder, everything for one applicant
  // organization lives under one path (mirrors the visa-documents bucket's
  // relational-RLS pattern rather than a flat uid-prefixed filename).
  const storagePath = `${kind}/${id}/${docKey}/${Date.now()}-${sanitizeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from("kyc-documents")
    .upload(storagePath, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const existing: DocumentRef[] = Array.isArray(application.document_refs) ? (application.document_refs as DocumentRef[]) : [];
  const previous = existing.filter((d) => d.key === docKey);
  if (previous.length > 0) {
    await supabase.storage.from("kyc-documents").remove(previous.map((p) => p.storage_path));
  }
  const next = [
    ...existing.filter((d) => d.key !== docKey),
    { key: docKey, label: docLabel, storage_path: storagePath, file_name: file.name, file_size: file.size, expiry, uploaded_at: new Date().toISOString() },
  ];

  const { error } = await supabase.from(APP_CONFIG[kind].table).update({ document_refs: next } as never).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(wizardPath(kind, id, 5));
  return { error: null };
}

export async function removeApplicationDocument(formData: FormData): Promise<void> {
  const kind = kindOf(formData);
  const id = String(formData.get("applicationId"));
  const docKey = String(formData.get("docKey") || "");

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(kind, id, user.id);
  if (!application) return;

  const existing: DocumentRef[] = Array.isArray(application.document_refs) ? (application.document_refs as DocumentRef[]) : [];
  const toRemove = existing.filter((d) => d.key === docKey);
  if (toRemove.length > 0) {
    await supabase.storage.from("kyc-documents").remove(toRemove.map((p) => p.storage_path));
  }
  const next = existing.filter((d) => d.key !== docKey);
  await supabase.from(APP_CONFIG[kind].table).update({ document_refs: next } as never).eq("id", id);
  revalidatePath(wizardPath(kind, id, 5));
}

/** Separate from the upload itself so an applicant can correct/renew the expiry on an already-uploaded license without re-uploading the file. */
export async function updateDocumentExpiry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = kindOf(formData);
  const id = String(formData.get("applicationId"));
  const docKey = String(formData.get("docKey") || "");
  const expiry = String(formData.get("expiry") || "") || null;
  if (!isValidExpiry(expiry)) return { error: "Enter a valid expiry date." };

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(kind, id, user.id);
  if (!application) return { error: "This application can no longer be edited." };

  const existing: DocumentRef[] = Array.isArray(application.document_refs) ? (application.document_refs as DocumentRef[]) : [];
  if (!existing.some((d) => d.key === docKey)) return { error: "Upload the document before setting an expiry date." };
  const next = existing.map((d) => (d.key === docKey ? { ...d, expiry } : d));

  const { error } = await supabase.from(APP_CONFIG[kind].table).update({ document_refs: next } as never).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(wizardPath(kind, id, 5));
  return { error: null };
}

/** Signed URL is generated on demand (not stored) so a stale/expired link is never rendered — callers open the returned URL directly. */
export async function getDocumentViewUrl(kind: ApplicationKind, id: string, docKey: string): Promise<{ url: string } | { error: string }> {
  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(kind, id, user.id);
  if (!application) return { error: "This application can no longer be edited." };

  const refs: DocumentRef[] = Array.isArray(application.document_refs) ? (application.document_refs as DocumentRef[]) : [];
  const ref = refs.find((d) => d.key === docKey);
  if (!ref) return { error: "Document not found." };

  const { data, error } = await supabase.storage.from("kyc-documents").createSignedUrl(ref.storage_path, 3600);
  if (error || !data) return { error: "Could not generate a link." };
  return { url: data.signedUrl };
}

export async function advanceToReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = kindOf(formData);
  const id = String(formData.get("applicationId"));
  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(kind, id, user.id);
  if (!application) redirect("/account/become");

  const uploaded = new Set(
    (Array.isArray(application!.document_refs) ? (application!.document_refs as DocumentRef[]) : []).map((d) => d.key)
  );
  const missing = docSlotsFor(kind).filter((slot) => !slot.optional && !uploaded.has(slot.key));
  if (missing.length > 0) {
    return { error: `Please upload: ${missing.map((s) => s.label).join(", ")}.` };
  }

  const currentStep = Number((application!.business_details as Record<string, unknown> | null)?._wizard_step) || 1;
  const details = mergeDetails(application!.business_details, { _wizard_step: Math.max(6, currentStep) });
  await supabase.from(APP_CONFIG[kind].table).update({ business_details: details } as never).eq("id", id);
  redirect(wizardPath(kind, id, 6));
}

// ---------------------------------------------------------------------------
// Step 6 — review & submit
// ---------------------------------------------------------------------------
const submitSchema = z.object({ agreeTerms: z.literal("on") });

export async function submitApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kind = kindOf(formData);
  const id = String(formData.get("applicationId"));
  const parsed = submitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "You must agree to the Partner Terms & Conditions to submit." };

  const user = await requireUser();
  const { supabase, application } = await getEditableApplication(kind, id, user.id);
  if (!application) return { error: "This application can no longer be edited." };

  const details = (application.business_details ?? {}) as Record<string, unknown>;
  const requiredDetailKeys =
    kind === "affiliate" ? ["fullName", "email", "idNumber"] : ["legalBusinessName", "contactFullName", "contactEmail"];
  if (requiredDetailKeys.some((key) => !details[key])) {
    return { error: "Please complete the earlier steps before submitting." };
  }

  const uploaded = new Set(
    (Array.isArray(application.document_refs) ? (application.document_refs as DocumentRef[]) : []).map((d) => d.key)
  );
  const missing = docSlotsFor(kind).filter((slot) => !slot.optional && !uploaded.has(slot.key));
  if (missing.length > 0) {
    return { error: `Please upload: ${missing.map((s) => s.label).join(", ")}.` };
  }

  const cfg = APP_CONFIG[kind];
  // Re-submitting an application that's already pending/under_review (an
  // applicant fixing something after the fact) must not churn its
  // reference number or overwrite its original submission timestamp —
  // both are things admins and applicants already cite when talking about
  // this specific application.
  let refData = application.reference_number;
  if (!refData) {
    const { data: newRef, error: refError } = await supabase.rpc(cfg.refRpc);
    if (refError || !newRef) return { error: "Could not generate a reference number. Try again." };
    refData = newRef;
  }

  const { error } = await supabase
    .from(cfg.table)
    .update({
      status: "pending",
      submitted_at: application.submitted_at ?? new Date().toISOString(),
      reference_number: refData,
    })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/account/become");
  redirect(
    `/account/become?submitted=${encodeURIComponent(refData)}&program=${
      kind === "agency" ? "agent" : kind === "hotel_partner" ? "partner" : kind === "venue_partner" ? "venue" : "affiliate"
    }`
  );
}
