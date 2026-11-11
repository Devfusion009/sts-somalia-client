import "server-only";
import { z } from "zod";
import { phoneSchema } from "@/modules/partner-applications/schemas";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";

const PASSPORT_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const PASSPORT_MAX_BYTES = 5 * 1024 * 1024;

const isoDate = (message: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, message).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, message);
const country = (message: string) => z.string().regex(/^[A-Z]{2}$/, message);
const optionalText = z.string().trim().max(200).optional().transform((value) => value || null);

/** Traveler profile, shaped after the Amadeus Flight Create Orders traveler object. */
const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter the first name.").max(100),
  middleName: optionalText,
  lastName: z.string().trim().min(1, "Enter the last name.").max(100),
  gender: z.enum(["male", "female"], { message: "Select a gender." }),
  dateOfBirth: isoDate("Enter the date of birth."),
  nationality: country("Select a nationality."),
  birthPlace: optionalText,
  phone: phoneSchema,
  whatsapp: phoneSchema.optional(),
  email: z.string().trim().email("Enter a valid email.").optional().or(z.literal("")),
  address: optionalText,
  passportNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,20}$/, "Enter a valid passport number."),
  passportIssuingCountry: country("Select the issuing country."),
  passportIssueDate: isoDate("Enter the passport issue date."),
  passportExpiryDate: isoDate("Enter the passport expiry date."),
  passportIssuanceLocation: optionalText,
  notes: z.string().trim().max(2000).optional().transform((value) => value || null),
  residenceCountry: country("Select the country of residence.").optional(),
  city: optionalText,
  postalCode: optionalText,
  emergencyContactName: optionalText,
  emergencyContactPhone: phoneSchema.optional(),
  emergencyContactRelationship: optionalText,
  preferredCabin: z.enum(["economy", "premium_economy", "business", "first"]).optional(),
  travelPreferences: z.string().trim().max(2000).optional().transform((value) => value || null),
}).superRefine((data, ctx) => {
  const today = new Date().toISOString().slice(0, 10);
  if (data.dateOfBirth >= today) ctx.addIssue({ code: "custom", message: "Date of birth must be in the past." });
  if (data.passportIssueDate < data.dateOfBirth) ctx.addIssue({ code: "custom", message: "Passport issue date cannot be before the date of birth." });
  if (data.passportIssueDate > today) ctx.addIssue({ code: "custom", message: "Passport issue date cannot be in the future." });
  if (data.passportExpiryDate <= data.passportIssueDate) ctx.addIssue({ code: "custom", message: "Passport expiry must be after the issue date." });
  if (data.passportExpiryDate <= today) ctx.addIssue({ code: "custom", message: "Passport has expired." });
});

type CustomerInsert = Database["public"]["Tables"]["agency_customers"]["Insert"];
type CustomerFields = Omit<CustomerInsert, "agency_id" | "created_by">;
type ServerClient = Awaited<ReturnType<typeof createClient>>;

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
};

/** Validates the profile fields and passport copy; uploads the copy and returns the row to insert. */
export async function buildCustomerProfile(
  supabase: ServerClient,
  agencyId: string,
  createdBy: string,
  formData: FormData,
  existingPassportPath?: string | null
): Promise<{ error: string } | { row: CustomerInsert; fields: CustomerFields; uploadedPath: string | null }> {
  const parsed = profileSchema.safeParse({
    firstName: text(formData, "firstName"),
    middleName: text(formData, "middleName"),
    lastName: text(formData, "lastName"),
    gender: text(formData, "gender"),
    dateOfBirth: text(formData, "dateOfBirth"),
    nationality: text(formData, "nationality"),
    birthPlace: text(formData, "birthPlace"),
    phone: text(formData, "phone") ?? "",
    whatsapp: text(formData, "whatsapp") || undefined,
    email: text(formData, "email") ?? "",
    address: text(formData, "address"),
    passportNumber: text(formData, "passportNumber") ?? "",
    passportIssuingCountry: text(formData, "passportIssuingCountry"),
    passportIssueDate: text(formData, "passportIssueDate"),
    passportExpiryDate: text(formData, "passportExpiryDate"),
    passportIssuanceLocation: text(formData, "passportIssuanceLocation"),
    notes: text(formData, "notes"),
    residenceCountry: text(formData, "residenceCountry") || undefined,
    city: text(formData, "city"),
    postalCode: text(formData, "postalCode"),
    emergencyContactName: text(formData, "emergencyContactName"),
    emergencyContactPhone: text(formData, "emergencyContactPhone") || undefined,
    emergencyContactRelationship: text(formData, "emergencyContactRelationship"),
    preferredCabin: text(formData, "preferredCabin") || undefined,
    travelPreferences: text(formData, "travelPreferences"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const file = formData.get("passportCopy");
  let uploadedPath: string | null = null;
  let passportPath = existingPassportPath ?? null;
  if (file instanceof File && file.size > 0) {
    if (!PASSPORT_TYPES.includes(file.type)) return { error: "Passport copy must be JPG, PNG or PDF." };
    if (file.size > PASSPORT_MAX_BYTES) return { error: "Passport copy must be 5 MB or smaller." };
    const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    uploadedPath = `${agencyId}/${crypto.randomUUID()}-passport.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("customer-documents")
      .upload(uploadedPath, file, { contentType: file.type });
    if (uploadError) return { error: "Passport copy could not be uploaded." };
    passportPath = uploadedPath;
  }
  if (!passportPath) return { error: "Upload the passport copy." };

  const d = parsed.data;
  const fields: CustomerFields = {
    full_name: [d.firstName, d.middleName, d.lastName].filter(Boolean).join(" "),
    first_name: d.firstName,
    middle_name: d.middleName,
    last_name: d.lastName,
    gender: d.gender,
    date_of_birth: d.dateOfBirth,
    nationality: d.nationality,
    birth_place: d.birthPlace,
    phone: d.phone,
    whatsapp: d.whatsapp ?? null,
    email: d.email || null,
    address: d.address,
    passport_number: d.passportNumber,
    passport_issuing_country: d.passportIssuingCountry,
    passport_issue_date: d.passportIssueDate,
    passport_expiry_date: d.passportExpiryDate,
    passport_issuance_location: d.passportIssuanceLocation,
    passport_file_path: passportPath,
    notes: d.notes,
    residence_country: d.residenceCountry ?? null,
    city: d.city,
    postal_code: d.postalCode,
    emergency_contact_name: d.emergencyContactName,
    emergency_contact_phone: d.emergencyContactPhone ?? null,
    emergency_contact_relationship: d.emergencyContactRelationship,
    preferred_cabin: d.preferredCabin ?? null,
    travel_preferences: d.travelPreferences,
  };
  return { uploadedPath, fields, row: { ...fields, agency_id: agencyId, created_by: createdBy } };
}
