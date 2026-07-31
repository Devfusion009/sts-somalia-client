"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { getVisaTypeById } from "@/lib/data/visa";
import { createOrderForBooking, getActiveAgencyId } from "@/lib/booking/order-helpers";

export type ActionState = { error: string | null } | null;

const applicationSchema = z.object({
  visaTypeId: z.string().uuid(),
  fullName: z.string().min(2, "Enter the traveler's full name."),
  dateOfBirth: z.string().min(1, "Enter a date of birth."),
  nationality: z.string().min(2, "Enter a nationality."),
  passportNumber: z.string().min(3, "Enter a passport number."),
  passportExpiry: z.string().min(1, "Enter the passport expiry date."),
  notes: z.string().optional(),
});

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

export async function submitVisaApplication(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = applicationSchema.safeParse({
    visaTypeId: formData.get("visaTypeId"),
    fullName: formData.get("fullName"),
    dateOfBirth: formData.get("dateOfBirth"),
    nationality: formData.get("nationality"),
    passportNumber: formData.get("passportNumber"),
    passportExpiry: formData.get("passportExpiry"),
    notes: formData.get("notes")?.toString(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const user = await requireUser();
  const visaType = await getVisaTypeById(parsed.data.visaTypeId);
  if (!visaType) {
    return { error: "This visa service is no longer available." };
  }

  const supabase = await createClient();
  const agencyId = await getActiveAgencyId(supabase, user.id);

  const { data: application, error: applicationError } = await supabase
    .from("visa_applications")
    .insert({
      visa_type_id: visaType.id,
      applicant_profile_id: user.id,
      submitted_by: user.id,
      agency_id: agencyId,
      traveler_details: {
        full_name: parsed.data.fullName,
        date_of_birth: parsed.data.dateOfBirth,
        nationality: parsed.data.nationality,
        passport_number: parsed.data.passportNumber,
        passport_expiry: parsed.data.passportExpiry,
      },
      applicant_notes: parsed.data.notes || null,
      status: "submitted",
      price: visaType.price,
      currency: visaType.currency,
    })
    .select()
    .single();

  if (applicationError || !application) {
    return { error: applicationError?.message ?? "Could not submit your application. Please try again." };
  }

  const documents = formData.getAll("documents").filter((f): f is File => f instanceof File && f.size > 0);

  for (const [index, file] of documents.entries()) {
    const storagePath = `${application.id}/${index}-${sanitizeFilename(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("visa-documents")
      .upload(storagePath, file, { contentType: file.type || undefined });

    if (!uploadError) {
      await supabase.from("visa_documents").insert({
        application_id: application.id,
        document_type: file.name,
        storage_path: storagePath,
        uploaded_by: user.id,
      });
    }
  }

  await createOrderForBooking(supabase, {
    customerId: user.id,
    bookedBy: user.id,
    agencyId,
    currency: visaType.currency,
    itemType: "visa",
    price: visaType.price,
    visaApplicationId: application.id,
  });

  redirect("/account/bookings?success=visa");
}
