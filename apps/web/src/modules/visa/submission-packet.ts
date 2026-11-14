import type { VisaCase } from "./case-queries";
import { countryName } from "@/lib/countries";
import { formatRequirementAnswer, memberRequirementAnswers, parseRequirementAnswers, parseRequirementSections } from "./schemas";

const STAFF_DOCUMENTS = new Set(["visa_result", "decision_letter", "submission_receipt", "passport_authorization"]);

export function submissionDocuments(data: VisaCase) {
  const waived = new Set(data.application.document_requests.filter(r => r.status === "waived").map(r => r.id));
  return data.application.documents.filter(doc => doc.is_current && !STAFF_DOCUMENTS.has(doc.document_type) && !(doc.request_id && waived.has(doc.request_id)))
    .map(doc => ({ ...doc, label: data.documentSlots.find(slot => slot.versions.some(version => version.id === doc.id))?.label ?? doc.document_type.replace(/_/g, " ") }));
}

export function submissionBlocker(data: VisaCase): string | null {
  if (data.application.status !== "ready_for_processing") return "Mark the application ready for submission first.";
  if (!["paid", "partially_paid"].includes(data.paymentState)) return "Confirm payment before preparing the submission.";
  if (!data.readiness.some(item => item.key === "documents_complete" && item.ok) || !data.readiness.some(item => item.key === "documents_reviewed" && item.ok)) return "Complete and verify the required documents first.";
  const incomplete = data.readiness.find(item => item.applies && !item.ok);
  if (incomplete) return `${incomplete.label} is outstanding.`;
  const docs = submissionDocuments(data);
  if (docs.some(doc => doc.review_status !== "accepted")) return "Verify all current submission documents first.";
  return null;
}

export function submissionEmailText(data: VisaCase) {
  const app = data.application;
  const traveler = (app.traveler_details ?? {}) as Record<string, string>;
  const travel = (app.travel_details ?? {}) as Record<string, string>;
  const contact = (app.contact_details ?? {}) as Record<string, string>;
  const sections = parseRequirementSections(app.visa_type?.application_sections);
  const answers = parseRequirementAnswers(app.custom_answers);
  const lines = ["Dear Visa Officer,", "", `Please find the visa application and supporting documents for ${traveler.full_name || "the applicants listed below"}.`, "", `Application reference: ${app.application_ref}`, `Destination: ${countryName(app.visa_type?.destination_country_code ?? "")}`, `Visa: ${app.visa_type?.name ?? ""}`, `Entry type: ${app.visa_type?.entry_type ?? ""}`, `Application type: ${app.applicant_type}`, `Booking channel: ${app.agency_id ? app.agency?.name ?? "Agency booking" : "Direct customer"}`, "", "APPLICATION CONTACT", `Email: ${contact.email || "Not provided"}`, `Phone: ${contact.mobile || "Not provided"}`, "", "TRAVEL DETAILS", `Arrival: ${travel.arrival_date || "Not provided"}`, `Departure: ${travel.departure_date || "Not provided"}`, `Purpose: ${travel.purpose || "Not provided"}`, `Address at destination: ${travel.address || "Not provided"}`, "", `Primary applicant gender: ${traveler.gender || "Not provided"}`, "", "APPLICANTS"];
  const people = app.members.length ? app.members : [{ full_name: traveler.full_name, relationship: "self", date_of_birth: traveler.date_of_birth, nationality: traveler.nationality, passport_number: traveler.passport_number, passport_expiry: traveler.passport_expiry, details: {} }];
  for (const person of people) {
    lines.push("", `Full name: ${person.full_name}`, `Relationship: ${person.relationship}`, `Date of birth: ${person.date_of_birth || "Not provided"}`, `Nationality: ${person.nationality ? countryName(person.nationality) : "Not provided"}`, `Passport number: ${person.passport_number || "Not provided"}`, `Passport expiry: ${person.passport_expiry || "Not provided"}`);
    for (const section of sections.filter(s => s.scope === "traveller")) {
      lines.push(section.title);
      const memberAnswers = memberRequirementAnswers(person.details)[section.key];
      for (const field of section.fields.filter(f => f.type !== "file")) lines.push(`${field.label}: ${formatRequirementAnswer(field, memberAnswers?.[field.key]) || "Not provided"}`);
    }
  }
  for (const section of sections.filter(s => s.scope === "application")) {
    lines.push("", section.title);
    for (const field of section.fields.filter(f => f.type !== "file")) lines.push(`${field.label}: ${formatRequirementAnswer(field, answers[section.key]?.[field.key]) || "Not provided"}`);
  }
  lines.push("", "ATTACHED DOCUMENTS", ...submissionDocuments(data).map((doc, index) => `${index + 1}. ${doc.label} — ${doc.file_name ?? "Document"}`), "", "Please confirm receipt and advise if further information is required.", "", "Kind regards,", "STS Visa Desk");
  return lines.join("\n");
}
